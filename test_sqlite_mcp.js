const { spawn } = require('child_process');

const server = spawn('npx', ['-y', 'mcp-server-sqlite', '/home/levent/.forge-ide/forge.db']);

server.stdout.on('data', (data) => {
  console.log();
});

server.stderr.on('data', (data) => {
  console.error();
});

// initialize -> list-tables -> exit
server.on('spawn', () => {
  const initReq = JSON.stringify({
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: { capabilities: {}, clientInfo: { name: 'test', version: '1' }, protocolVersion: '2024-11-05' }
  });
  server.stdin.write(initReq + '\n');
  
  setTimeout(() => {
    const listReq = JSON.stringify({
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/call',
      params: { name: 'list-tables', arguments: {} }
    });
    server.stdin.write(listReq + '\n');
  }, 2000);
});
