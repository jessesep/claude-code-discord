import OSCModule from "npm:osc-js";
const OSC = (OSCModule as any).default || OSCModule;

const msg = new OSC.Message('/test', 1, 2.5, 'hello');
const binary = msg.pack();
console.log("Packed:", binary);

const decoded = new OSC.Message();
decoded.unpack(new DataView(binary.buffer), 0);
console.log("Decoded Address:", decoded.address);
console.log("Decoded Args:", decoded.args);
