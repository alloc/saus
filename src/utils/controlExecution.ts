import { defer, Deferred } from './defer'

type Promisable<T> = T | Promise<T>

export type ExecutorState<Args extends any[] = any, Result = any> = {
  activeCalls: Set<Args>
  queuedCalls: Args[]
  calls: Map<Args, Deferred<Awaited<Result>>>
}

type Executor<Args extends any[] = any, State = {}, Result = any> = {
  (this: State & ExecutorState<Args>, ...args: Args): Result
}

type ExecutionGateMethods<Args extends any[] = any[]> = {
  /** Rerun the `schedule` handler with the given args. */
  reschedule: (args: Args) => void
  /** Run the wrapped function with the given args immediately. */
  execute: (args: Args) => Promise<void>
}

export type ExecutionGateContext<
  State = {},
  Args extends any[] = any,
  Result = any
> = ExecutionGateMethods<Args> & ExecutorState<Args, Result> & State

/** This function controls which calls are queued and when. */
export type ExecutionGate<
  Args extends any[] = any,
  State = {},
  Result = any
> = (
  ctx: ExecutionGateContext<State, Args, Result>,
  args: Args,
  wasQueued?: boolean
) => Promisable<void>

/** Calls to this function are intercepted by an execution controller. */
export type ControlledFunction<
  Args extends any[] = any[],
  State = {},
  Result = any
> = {
  (...args: Args): Promise<Awaited<Result>>

  /** Bypass the execution controller */
  execute: (...args: Args) => Result
  state: State & ExecutorState<Args, Result>
}

/**
 * The provided `execute` function has its calls intercepted by the
 * `schedule` handler (set by `.with` on the returned object).
 */
export function controlExecution<Args extends any[], State, Result>(
  execute: Executor<Args, State, Result>,
  initialState?: State
) {
  return {
    /**
     * One of the following things must be done, or else the intercepted
     * call will be dropped.
     *
     *     controlExecution(…).with((ctx, args) => {
     *       // a. Run immediately
     *       ctx.execute(args)
     *       // b. Queue it to run once enough active calls are finished
     *       ctx.queuedCalls.push(args)
     *       // c. Rerun the schedule handler
     *       ctx.reschedule(args)
     *     })
     */
    with(
      schedule: ExecutionGate<Args, State, Result>
    ): ControlledFunction<Args, State, Result> {
      const state: State & ExecutorState<Args, Result> = {
        ...(initialState as State),
        activeCalls: new Set(),
        queuedCalls: [],
        calls: new Map(),
      }

      const ctx: ExecutionGateContext<State, Args, Result> = {
        __proto__: state,
        reschedule: scheduleCall,
        execute: executeCall,
      } as any

      async function scheduleCall(
        args?: Args,
        wasQueued?: boolean,
        call = args && ctx.calls.get(args)
      ) {
        if (!args || !call) return
        try {
          await schedule(ctx, args, wasQueued)
        } catch (e: any) {
          call.reject(e)
        }
      }

      async function executeCall(args: Args, call = ctx.calls.get(args)) {
        if (!call) return
        try {
          ctx.activeCalls.add(args)
          call.resolve(await execute.apply(state, args))
        } catch (e: any) {
          call.reject(e)
        }
      }

      function fn(...args: Args): any {
        const call = defer<Awaited<Result>>()
        ctx.calls.set(args, call)
        scheduleCall(args, false, call)
        return call.promise.finally(() => {
          ctx.activeCalls.delete(args)
          ctx.calls.delete(args)
          process.nextTick(() => {
            scheduleCall(ctx.queuedCalls.shift(), true)
          })
        })
      }

      fn.state = state
      fn.execute = execute
      return fn
    },
  }
}
