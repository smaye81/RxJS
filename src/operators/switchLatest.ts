import Operator from '../Operator';
import Observer from '../Observer';
import Observable from '../Observable';
import Subscription from '../Subscription';

import {FlatMapOperator, FlatMapSubscriber} from './flatMap';

export default function switchLatest<T, R>(project: (x: T, ix: number) => Observable<any>,
                                           projectResult?: (x: T, y: any, ix: number, iy: number) => R) {
  return this.lift(new SwitchLatestOperator(project, projectResult));
}

export class SwitchLatestOperator<T, R> extends FlatMapOperator<T, R> {

  constructor(project: (x: T, ix: number) => Observable<any>,
              projectResult?: (x: T, y: any, ix: number, iy: number) => R) {
    super(project, projectResult, 1);
  }

  call(observer: Observer<R>): Observer<T> {
    return new SwitchLatestSubscriber(observer, this.project, this.projectResult);
  }
}

export class SwitchLatestSubscriber<T, R> extends FlatMapSubscriber<T, R> {

  innerSubscription: Subscription<T>;

  constructor(destination: Observer<R>,
              project: (x: T, ix: number) => Observable<any>,
              projectResult?: (x: T, y: any, ix: number, iy: number) => R) {
    super(destination, 1, project, projectResult);
  }

  _buffer(value) {
    const active = this.active;
    if(active > 0) {
      this.active = active - 1;
      const inner = this.innerSubscription;
      if(inner) {
        inner.unsubscribe()
      }
    }
    this._next(value);
  }

  _subscribeInner(observable, value, index) {
    return (this.innerSubscription = super._subscribeInner(observable, value, index));
  }
}
