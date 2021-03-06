import Operator from '../Operator';
import Observer from '../Observer';
import Subscriber from '../Subscriber';
import Observable from '../Observable';
import Subject from '../Subject';
import Subscription from '../Subscription';

import tryCatch from '../util/tryCatch';
import {errorObject} from '../util/errorObject';
import bindCallback from '../util/bindCallback';

export default function windowToggle<T, O>(openings: Observable<O>, closingSelector: (openValue: O) => Observable<any>) : Observable<Observable<T>> {
  return this.lift(new WindowToggleOperator<T, T, O>(openings, closingSelector));
}

export class WindowToggleOperator<T, R, O> implements Operator<T, R> {

  constructor(private openings: Observable<O>, private closingSelector: (openValue: O) => Observable<any>) {
  }

  call(observer: Observer<T>): Observer<T> {
    return new WindowToggleSubscriber<T, O>(observer, this.openings, this.closingSelector);
  }
}

export class WindowToggleSubscriber<T, O> extends Subscriber<T> {
  private windows: Subject<T>[] = [];
  private closingNotification: Subscription<any>;
  
  constructor(destination: Observer<T>, private openings: Observable<O>, private closingSelector: (openValue: O) => Observable<any>) {
    super(destination);
    this.add(this.openings.subscribe(new WindowToggleOpeningsSubscriber(this)));
  }

  _next(value: T) {
    const windows = this.windows;
    const len = windows.length;
    for (let i = 0; i < len; i++) {
      windows[i].next(value);
    }
  }
  
  _error(err: any) {
    const windows = this.windows;
    while (windows.length > 0) {
      windows.shift().error(err);
    }
    this.destination.error(err);
  }
  
  _complete() {
    const windows = this.windows;
    while (windows.length > 0) {
      windows.shift().complete();
    }
    this.destination.complete();
  }
  
  openWindow(value: O) {
    const window = new Subject<T>();
    this.windows.push(window);
    this.destination.next(window);
    let windowContext = {
      window,
      subscription: null
    };

    const closingSelector = this.closingSelector;
    let closingNotifier = tryCatch(closingSelector)(value);
    if (closingNotifier === errorObject) {
      this.error(closingNotifier.e);
    } else {
      this.add(windowContext.subscription = closingNotifier.subscribe(new WindowClosingNotifierSubscriber<T, O>(this, windowContext)));
    }
  }
  
  closeWindow(windowContext: { subscription: Subscription<T>, window: Subject<T> }) {
    const { window, subscription } = windowContext;
    const windows = this.windows;
    windows.splice(windows.indexOf(window), 1);
    window.complete();
    this.remove(subscription);
  }
}

export class WindowClosingNotifierSubscriber<T, O> extends Subscriber<T> {
  constructor(private parent: WindowToggleSubscriber<T, O>, private windowContext: { window: Subject<T>, subscription: Subscription<T> }) {
    super(null);
  }
  
  _next() {
    this.parent.closeWindow(this.windowContext);
  }
  
  _error(err) {
    this.parent.error(err);
  }
  
  _complete() {
    // noop
  }
}

export class WindowToggleOpeningsSubscriber<T> extends Subscriber<T> {
  constructor(private parent: WindowToggleSubscriber<any, T>) {
    super();
  }
  
  _next(value: T) {
    this.parent.openWindow(value);
  }
  
  _error(err) {
    this.parent.error(err);
  }
  
  _complete() {
    // noop
  }
}