/**
 * Priority Queue for Discrete Event Simulation
 * Events are processed in chronological order
 */

import { SimEvent } from './types';

export class EventQueue {
  private events: SimEvent[] = [];
  
  /**
   * Add an event to the queue (maintains sorted order)
   */
  push(event: SimEvent): void {
    // Binary search for insertion point
    let left = 0;
    let right = this.events.length;
    
    while (left < right) {
      const mid = Math.floor((left + right) / 2);
      if (this.events[mid].time <= event.time) {
        left = mid + 1;
      } else {
        right = mid;
      }
    }
    
    this.events.splice(left, 0, event);
  }
  
  /**
   * Remove and return the earliest event
   */
  pop(): SimEvent | undefined {
    return this.events.shift();
  }
  
  /**
   * Peek at the earliest event without removing
   */
  peek(): SimEvent | undefined {
    return this.events[0];
  }
  
  /**
   * Check if queue is empty
   */
  isEmpty(): boolean {
    return this.events.length === 0;
  }
  
  /**
   * Get queue size
   */
  size(): number {
    return this.events.length;
  }
  
  /**
   * Clear all events
   */
  clear(): void {
    this.events = [];
  }
  
  /**
   * Remove all events of a specific type from a source
   */
  removeEvents(source: number, type: string): void {
    this.events = this.events.filter(e => 
      !(e.source === source && e.type === type)
    );
  }
  
  /**
   * Get all events (for debugging)
   */
  getAllEvents(): SimEvent[] {
    return [...this.events];
  }
}
