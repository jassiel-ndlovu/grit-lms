// public/timer-worker.js
let timerInterval;

self.onmessage = function(e) {
  console.log('Worker received command:', e.data.command);
  
  if (e.data.command === 'start') {
    const { startTime, timeLimit, dueDate } = e.data;
    
    console.log('Starting timer with:', { startTime, timeLimit, dueDate });
    
    // Clear any existing interval
    if (timerInterval) {
      clearInterval(timerInterval);
    }
    
    timerInterval = setInterval(() => {
      try {
        const now = Date.now();
        const elapsedSeconds = Math.floor((now - startTime) / 1000);
        const timeLimitSeconds = timeLimit * 60;
        const dueDateMs = new Date(dueDate).getTime();
        const secondsToDueDate = Math.floor((dueDateMs - now) / 1000);
        
        const remainingFromStart = Math.max(0, timeLimitSeconds - elapsedSeconds);
        const remaining = Math.max(0, Math.min(remainingFromStart, secondsToDueDate));
        
        // Send update every second
        self.postMessage({ remaining });
        
        // Check if time expired
        if (remaining <= 0) {
          console.log('Time expired in worker');
          clearInterval(timerInterval);
          self.postMessage({ expired: true });
        }
      } catch (error) {
        console.error('Error in worker timer:', error);
        self.postMessage({ error: error.message });
      }
    }, 1000);
    
  } else if (e.data.command === 'stop') {
    console.log('Stopping timer');
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
  } else if (e.data.command === 'test') {
    self.postMessage({ test: 'Worker is working' });
  }
};