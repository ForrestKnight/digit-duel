/**
 * Debouncing utilities to reduce server load and prevent rapid-fire operations
 * that cause write conflicts in Convex.
 */

/**
 * Creates a debounced version of a function that delays invoking until after
 * wait milliseconds have elapsed since the last time it was invoked.
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number,
  immediate = false
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  
  return function executedFunction(...args: Parameters<T>) {
    const later = function() {
      timeout = null;
      if (!immediate) func(...args);
    };
    
    const callNow = immediate && !timeout;
    
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(later, wait);
    
    if (callNow) func(...args);
  };
}

/**
 * Creates a throttled version of a function that only invokes at most once
 * per every wait milliseconds.
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;
  
  return function(...args: Parameters<T>) {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, wait);
    }
  };
}

/**
 * Rate limiter that prevents operations from being called too frequently.
 * Useful for preventing spam clicks that cause write conflicts.
 */
export class RateLimiter {
  private lastCall: number = 0;
  private minInterval: number;

  constructor(minIntervalMs: number) {
    this.minInterval = minIntervalMs;
  }

  canExecute(): boolean {
    const now = Date.now();
    if (now - this.lastCall >= this.minInterval) {
      this.lastCall = now;
      return true;
    }
    return false;
  }

  timeUntilNext(): number {
    const now = Date.now();
    const elapsed = now - this.lastCall;
    return Math.max(0, this.minInterval - elapsed);
  }
}

/**
 * Batches operations together to reduce database load.
 * Collects operations over a time window and executes them as a batch.
 */
export class OperationBatcher<T> {
  private batch: T[] = [];
  private timeout: ReturnType<typeof setTimeout> | null = null;
  private batchSize: number;
  private batchDelay: number;
  private executeBatch: (items: T[]) => void;

  constructor(
    executeBatch: (items: T[]) => void,
    batchSize: number = 10,
    batchDelay: number = 100
  ) {
    this.executeBatch = executeBatch;
    this.batchSize = batchSize;
    this.batchDelay = batchDelay;
  }

  add(item: T): void {
    this.batch.push(item);

    // Execute immediately if batch is full
    if (this.batch.length >= this.batchSize) {
      this.flush();
      return;
    }

    // Otherwise, set/reset the timer
    if (this.timeout) {
      clearTimeout(this.timeout);
    }

    this.timeout = setTimeout(() => {
      this.flush();
    }, this.batchDelay);
  }

  flush(): void {
    if (this.batch.length === 0) return;

    const itemsToProcess = [...this.batch];
    this.batch = [];

    if (this.timeout) {
      clearTimeout(this.timeout);
      this.timeout = null;
    }

    this.executeBatch(itemsToProcess);
  }

  clear(): void {
    this.batch = [];
    if (this.timeout) {
      clearTimeout(this.timeout);
      this.timeout = null;
    }
  }
}

/**
 * Smart operation queue that automatically retries failed operations
 * with exponential backoff to handle temporary write conflicts.
 */
export class RetryQueue<T> {
  private queue: Array<{
    operation: () => Promise<T>;
    resolve: (value: T) => void;
    reject: (error: any) => void;
    attempts: number;
    maxRetries: number;
  }> = [];
  private processing = false;
  private baseDelay = 100;

  async add(
    operation: () => Promise<T>, 
    maxRetries: number = 3
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push({
        operation,
        resolve,
        reject,
        attempts: 0,
        maxRetries,
      });
      
      this.processQueue();
    });
  }

  private async processQueue(): Promise<void> {
    if (this.processing || this.queue.length === 0) {
      return;
    }

    this.processing = true;

    while (this.queue.length > 0) {
      const item = this.queue.shift()!;
      
      try {
        const result = await item.operation();
        item.resolve(result);
      } catch (error) {
        item.attempts++;
        
        if (item.attempts < item.maxRetries) {
          // Exponential backoff
          const delay = this.baseDelay * Math.pow(2, item.attempts - 1);
          await new Promise(resolve => setTimeout(resolve, delay));
          
          // Put it back in the queue
          this.queue.unshift(item);
        } else {
          item.reject(error);
        }
      }
    }

    this.processing = false;
  }
}

/**
 * Counter operation manager with built-in rate limiting and conflict resolution
 */
export class CounterOperationManager {
  private rateLimiter: RateLimiter;
  private retryQueue: RetryQueue<number>;

  constructor(minIntervalMs: number = 150) {
    this.rateLimiter = new RateLimiter(minIntervalMs);
    this.retryQueue = new RetryQueue<number>();
  }

  async increment(operation: () => Promise<number>): Promise<number | null> {
    if (!this.rateLimiter.canExecute()) {
      console.log(`Rate limited: wait ${this.rateLimiter.timeUntilNext()}ms`);
      return null;
    }

    return this.retryQueue.add(operation);
  }

  async decrement(operation: () => Promise<number>): Promise<number | null> {
    if (!this.rateLimiter.canExecute()) {
      console.log(`Rate limited: wait ${this.rateLimiter.timeUntilNext()}ms`);
      return null;
    }

    return this.retryQueue.add(operation);
  }

  async reset(operation: () => Promise<number>): Promise<number | null> {
    if (!this.rateLimiter.canExecute()) {
      console.log(`Rate limited: wait ${this.rateLimiter.timeUntilNext()}ms`);
      return null;
    }

    return this.retryQueue.add(operation);
  }
}
