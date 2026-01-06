const PORT = 9000;
const listener = Deno.listenDatagram({ port: PORT, transport: "udp" });
console.log(`UDP Server listening on port ${PORT}`);

for await (const [data, remoteAddr] of listener) {
  console.log(`Received ${data.length} bytes from ${JSON.stringify(remoteAddr)}`);
  const text = new TextDecoder().decode(data);
  console.log(`Content: ${text}`);
}
