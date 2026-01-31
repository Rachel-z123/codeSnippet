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
