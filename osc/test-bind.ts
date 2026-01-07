import OSC from "npm:osc-js";

const options = {
  plugin: new OSC.DatagramPlugin({ 
    type: 'udp4',
    open: { port: 9000, host: '0.0.0.0' }
  })
};

const osc = new OSC(options);

osc.on('open', () => console.log('OSC OPENED!'));
osc.on('error', (err: any) => console.log('OSC ERROR:', err));

console.log('Opening...');
try {
  osc.open();
  console.log('Open called.');
} catch (e) {
  console.log('Catch:', e);
}

setTimeout(() => {
  console.log('Status after 2s:', osc.status());
}, 2000);
