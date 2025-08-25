import { TICK_MS } from "./config.js";

export function createEngine({ onTick, onRender, tickMs = TICK_MS }) {
  let running=false, last=0, acc=0;
  let fps=0, frames=0, tFps=0;

  function frame(now){
    if(!running) return;
    if(!last){ last=now; tFps=now; }
    const dt = now - last; last = now;
    acc += dt;

    while(acc >= tickMs){ onTick && onTick(); acc -= tickMs; }

    onRender && onRender({ fps });

    frames++;
    if(now - tFps >= 1000){ fps=frames; frames=0; tFps=now; }
    requestAnimationFrame(frame);
  }

  return {
    start(){ if(running) return; running=true; last=0; requestAnimationFrame(frame); },
    stop(){ running=false; },
    getFps(){ return fps; },
    isRunning(){ return running; }
  };
}