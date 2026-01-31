class ConcurrentScheduler {
  constructor(maxConcurrent = 3) {
    this.maxConcurrent = maxConcurrent; // 最大并发数
    this.runningCount = 0; // 正在运行的任务数
    this.taskQueue = []; // 等待队列
    this.taskId = 0; // 任务ID
  }

  // 添加任务，返回Promise
  addTask(task) {
    return new Promise((resolve, reject) => {
      const taskId = ++this.taskId;
      const taskWrapper = {
        id: taskId,
        task,
        resolve,
        reject,
        status: 'pending'
      };

      this.taskQueue.push(taskWrapper);
      this.executeNext();

      return taskId;
    });
  }

  // 执行下一个任务
  executeNext() {
    // 检查是否可以执行新任务
    if (this.runningCount >= this.maxConcurrent) {
      return;
    }

    // 获取下一个任务
    const nextTask = this.taskQueue.shift();
    if (!nextTask) {
      return;
    }

    this.runningCount++;
    nextTask.status = 'running';

    console.log(`开始执行任务 ${nextTask.id}, 运行中: ${this.runningCount}`);

    // 执行任务
    Promise.resolve()
      .then(() => nextTask.task())
      .then(result => {
        nextTask.status = 'completed';
        nextTask.resolve(result);
      })
      .catch(error => {
        nextTask.status = 'failed';
        nextTask.reject(error);
      })
      .finally(() => {
        this.runningCount--;
        console.log(`任务 ${nextTask.id} 完成, 运行中: ${this.runningCount}`);
        this.executeNext(); // 执行下一个任务
      });
  }

  // 获取调度器状态
  getStatus() {
    return {
      maxConcurrent: this.maxConcurrent,
      running: this.runningCount,
      waiting: this.taskQueue.length,
      tasks: this.taskQueue.map(t => ({
        id: t.id,
        status: t.status
      }))
    };
  }
}

/**
我来详细分析这个 **支持并发控制的调度器** 代码：

## 一、核心设计分析

### 1. **类结构设计**
```javascript
class ConcurrentScheduler {
  constructor(maxConcurrent = 3) {
    this.maxConcurrent = maxConcurrent;  // ✅ 最大并发控制
    this.runningCount = 0;               // ✅ 当前运行计数
    this.taskQueue = [];                 // ✅ 等待队列
    this.taskId = 0;                     // ✅ 任务标识
  }
}
```
**特点**：
- **参数化设计**：`maxConcurrent` 作为构造参数，灵活配置
- **状态清晰**：四个核心状态变量各司其职
- **简单高效**：使用数组作为队列，O(1)的入队出队

### 2. **任务包装器设计**
```javascript
const taskWrapper = {
  id: taskId,      // 任务唯一标识
  task,            // 原始任务函数
  resolve,         // Promise 的 resolve 函数
  reject,          // Promise 的 reject 函数
  status: 'pending' // 任务状态
};
```
**巧妙之处**：
- **Promise 控制权转移**：将 `resolve/reject` 保存在任务对象中
- **状态管理**：便于跟踪任务生命周期
- **ID 系统**：便于调试和状态查询

## 二、执行流程分析

### 流程图
```
添加任务 → 包装任务 → 入队 → 尝试执行
                                      ↓
如果 runningCount < maxConcurrent → 出队 → 执行 → 更新状态
                                      ↑              ↓
                             任务完成/失败 ← 执行原始任务
                                        ↓
                                   runningCount-- → 尝试执行下一个
```

### 1. **添加任务流程** (`addTask`)
```javascript
addTask(task) {
  return new Promise((resolve, reject) => {
    const taskId = ++this.taskId;
    const taskWrapper = { /* ... */ };
    
    this.taskQueue.push(taskWrapper);  // ✅ 1. 入队
    this.executeNext();                // ✅ 2. 尝试执行
    
    return taskId;
  });
}
```
**关键点**：
- **立即返回 Promise**：调用者可以立即 `await` 或 `.then()`
- **同步入队**：任务立即进入队列，保证顺序
- **尝试执行**：入队后立即检查是否可以执行

### 2. **执行控制逻辑** (`executeNext`)
```javascript
executeNext() {
  // ✅ 1. 并发控制检查
  if (this.runningCount >= this.maxConcurrent) {
    return; // 达到最大并发，等待
  }
  
  // ✅ 2. 队列检查
  const nextTask = this.taskQueue.shift();
  if (!nextTask) {
    return; // 队列为空
  }
  
  // ✅ 3. 状态更新
  this.runningCount++;
  nextTask.status = 'running';
  
  // ✅ 4. 异步执行
  Promise.resolve()
    .then(() => nextTask.task())  // 执行原始任务
    .then(result => {
      nextTask.status = 'completed';
      nextTask.resolve(result);   // 解决调用者的Promise
    })
    .catch(error => {
      nextTask.status = 'failed';
      nextTask.reject(error);     // 拒绝调用者的Promise
    })
    .finally(() => {
      // ✅ 5. 清理和递归
      this.runningCount--;
      this.executeNext();         // 关键：触发下一个任务
    });
}
```

## 三、关键机制分析

### 1. **递归执行机制**
```javascript
.finally(() => {
  this.runningCount--;
  this.executeNext();  // ⭐️ 递归调用是关键！
});
```
**为什么重要**：
- 每当一个任务完成，就自动触发下一个任务的执行
- 形成 **"完成 → 检查 → 执行"** 的循环
- 确保队列中的任务被持续消费

### 2. **Promise 链设计**
```javascript
Promise.resolve()
  .then(() => nextTask.task())  // 执行用户任务
  .then(result => {
    nextTask.resolve(result);   // 通知调用者成功
  })
  .catch(error => {
    nextTask.reject(error);     // 通知调用者失败
  });
```
**三层转换**：
1. **调度器 Promise** → 立即 `resolve()` 启动
2. **用户任务 Promise** → `nextTask.task()` 执行
3. **调用者 Promise** → 通过保存的 `resolve/reject` 通知

### 3. **并发控制实现**
```javascript
// 入口控制
if (this.runningCount >= this.maxConcurrent) {
  return;
}

// 出口控制
.finally(() => {
  this.runningCount--;
  // ...
});
```
**控制逻辑**：
- **入口检查**：执行前检查是否超过限制
- **计数增减**：执行时`++`，完成时`--`
- **被动触发**：由任务完成驱动，而非轮询

## 四、使用示例分析

```javascript
// 创建调度器（最大并发2）
const scheduler = new ConcurrentScheduler(2);

// 模拟耗时任务
function createTask(id, duration) {
  return async () => {
    console.log(`任务${id}开始`);
    await new Promise(resolve => setTimeout(resolve, duration));
    console.log(`任务${id}完成`);
    return `任务${id}的结果`;
  };
}

// 添加4个任务
Promise.all([
  scheduler.addTask(createTask(1, 2000)),  // 任务1：2秒
  scheduler.addTask(createTask(2, 1000)),  // 任务2：1秒
  scheduler.addTask(createTask(3, 1500)),  // 任务3：1.5秒
  scheduler.addTask(createTask(4, 500))    // 任务4：0.5秒
]);
```

### **执行时序分析**：
```
时间线：
0ms: 添加任务1、2、3、4（快速连续添加）
      → 队列：[1, 2, 3, 4]
      → 立即执行任务1、2（并发数2）

0-1000ms: 任务1、2同时执行
1000ms: 任务2完成
      → runningCount: 2→1
      → 执行任务3
      → runningCount: 1→2

1500ms: 任务3完成
      → runningCount: 2→1
      → 执行任务4
      → runningCount: 1→2

2000ms: 任务1完成
      → runningCount: 2→1

2000ms: 任务4完成
      → runningCount: 1→0
      → 队列空，结束
```

## 五、优缺点分析

### ✅ **优点**
1. **简单清晰**：代码量少，逻辑直接
2. **并发控制精准**：严格限制同时执行任务数
3. **Promise 友好**：返回标准 Promise，易于集成
4. **自动调度**：无需手动触发，任务完成自动继续
5. **状态跟踪**：支持查看运行状态

### ⚠️ **潜在问题**
1. **无优先级**：先进先出，无法处理紧急任务
2. **无超时控制**：长时间任务可能阻塞队列
3. **无取消机制**：任务一旦开始无法取消
4. **无重试机制**：失败任务直接丢弃
5. **内存风险**：队列可能无限增长

## 六、改进建议

### 1. **添加取消支持**
```javascript
addTask(task) {
  return new Promise((resolve, reject) => {
    const taskWrapper = { /* ... */ };
    
    const cancel = () => {
      const index = this.taskQueue.findIndex(t => t.id === taskWrapper.id);
      if (index > -1) {
        this.taskQueue.splice(index, 1);
        taskWrapper.reject(new Error('任务被取消'));
        return true;
      }
      return false;
    };
    
    this.taskQueue.push(taskWrapper);
    this.executeNext();
    
    return { promise, cancel };
  });
}
```

### 2. **添加超时控制**
```javascript
executeNext() {
  // ... 前面代码不变
  
  // 添加超时
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => reject(new Error('超时')), 5000);
  });
  
  Promise.race([nextTask.task(), timeoutPromise])
    .then(result => { /* ... */ })
    .catch(error => { /* ... */ });
}
```

### 3. **添加优先级**
```javascript
addTask(task, priority = 0) {
  // 根据优先级插入队列
  const insertIndex = this.taskQueue.findIndex(t => t.priority > priority);
  if (insertIndex === -1) {
    this.taskQueue.push(taskWrapper);
  } else {
    this.taskQueue.splice(insertIndex, 0, taskWrapper);
  }
}
```

## 七、应用场景

1. **API 请求限流**：防止同时发起过多请求
2. **文件上传/下载**：控制同时传输的文件数量
3. **数据库连接池**：管理有限连接资源
4. **图片懒加载**：控制同时加载的图片数量
5. **批量数据处理**：限制并发处理的数据块

这个调度器的核心价值在于 **用简单的代码实现了强大的并发控制**，是理解异步编程和资源管理的优秀示例。

**/
