function acceptsEventStream(req) {
  return req.get?.('accept')?.includes('text/event-stream') || false;
}

function canWrite(res) {
  return !res.writableEnded && !res.destroyed;
}

function startEventStream(res) {
  res.status(200).set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.flushHeaders?.();

  const heartbeat = setInterval(() => {
    if (canWrite(res)) {
      res.write(': keepalive\n\n');
      res.flush?.();
    }
  }, 15000);
  heartbeat.unref?.();

  const stop = () => clearInterval(heartbeat);
  res.once?.('close', stop);
  return stop;
}

function sendEvent(res, event, payload) {
  if (!canWrite(res)) return false;
  res.write(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`);
  res.flush?.();
  return true;
}

module.exports = { acceptsEventStream, startEventStream, sendEvent };
