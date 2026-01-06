import OSC from "npm:osc-js";

const osc = new OSC({
  plugin: new OSC.DatagramPlugin({ send: { port: 9000, host: '127.0.0.1' } })
});

osc.on('open', () => {
  console.log('Sending /git/status to 127.0.0.1:9000');
  const message = new OSC.Message('/git/status');
  osc.send(message);
  
  setTimeout(() => {
    console.log('Sending /agent/select "architect" to 127.0.0.1:9000');
    const msg2 = new OSC.Message('/agent/select', 'architect');
    osc.send(msg2);
  }, 500);

  // Wait for feedback
  setTimeout(() => {
    console.log('Test sender finished');
    Deno.exit(0);
  }, 2000);
});

osc.on('*', (message: any) => {
  console.log(`[Test Client] Received feedback from bot: ${message.address}`, message.args);
});

osc.open();
