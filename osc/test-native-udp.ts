const listener = Deno.listenDatagram({
  port: 9000,
  transport: "udp",
  hostname: "0.0.0.0",
});

console.log("Listening on UDP 9000...");
for await (const [data, remoteAddr] of listener) {
  console.log(`Received ${data.length} bytes from ${JSON.stringify(remoteAddr)}`);
}
