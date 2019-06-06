// This file is required by the index.html file and will
// be executed in the renderer process for that window.
// All of the Node.js APIs are available in this process.

const serialport = require('serialport')
const createTable = require('data-table');
var app = require('http').createServer(handler)
var io = require('socket.io').listen(app, { origins: '*:*' });
var fs = require('fs');

var five = require('johnny-five');
var Interfaz = require("./interfaz")(five);

/* WEB SERVER */
app.listen(4268);

function handler(req, res) {
  fs.readFile(__dirname + '/public' + req.url,
    function (err, data) {
      if (err) {
        res.writeHead(404);
        return res.end('Not found');
      }
      res.writeHead(200);
      res.end(data);
    });
}

/* JOHNNY-FIVE GATEWAY */
var board;
var ifaz;
var instances = new Array();

function start() {
  ifaz = new Interfaz();
}

board = new five.Board({
  repl: false
});
board.on("ready", function () {
  start();
});

io.sockets.on('connection', function (socket) {

  socket.on('OUTPUT', function (data) {
    ifaz.output(data.index)[data.method](data.param);
  })

  socket.on('STEPPER', function (data) {
    ifaz.stepper(data.index)[data.method](data.param, function (result) {
      socket.emit('STEPPER_MESSAGE', { index: data.index, value: result });
    });
  })

  socket.on('SERVO', function (data) {
    ifaz.servo(data.index)[data.method](data.param);
  })

  socket.on('ANALOG', function (data) {
    ifaz.analog(data.index)[data.method](function (result) {
      socket.emit('ANALOG_MESSAGE', { index: data.index, value: result });
    });
  })

  socket.on('DIGITAL', function (data) {
    if (data.method == 'on') {
      ifaz.digital(data.index)[data.method](function (result) {
        socket.emit('DIGITAL_MESSAGE', { index: data.index, value: result });
      });
    } else {
      ifaz.digital(data.index)[data.method](data.param);
    }
  })

  socket.on('I2C', function (data) {
    ifaz.i2c(data.address)[data.method](data.register, data.param, function (result) {
      socket.emit('I2C_MESSAGE', { address: data.address, register: data.register, value: result });
    });
  })

  socket.on('DEVICE', function (data, fn) {
    let vm = new VM({ sandbox: { instances: instances, data: data, five: five } });
    try {
      let result = vm.run('new five.' + data.device + '(' + JSON.stringify(data.options) + ')');
      instances[instances.length] = result
    }
    catch (error) {
      console.error(error);
      fn(false);
    }
    fn(instances.length - 1);
  })

  socket.on('DEVICE_EVENT', function (data, fn) {
    if (typeof instances[data.id] == "object") {
      instances[data.id].on(data.event, function () {
        results = {};
        try {
          data.attributes.forEach((reg) => {
            results[reg] = this[reg];
          })
          socket.emit(data.event + data.id, { data: results });
        } catch (error) {
          console.log(error);
          fn(false);
        }
      });
      fn(true);
    } else {
      fn(false);
    }
  })

  socket.on('DEVICE_CALL', function (data, fn) {
    console.log(instances[data.id], data);
    let vm = new VM({ sandbox: { instances: instances, data: data } });
    try {
      let result = vm.run('instances[' + data.id + '].' + data.method);
    }
    catch (error) {
      console.error(error);
      fn(false);
    }
    fn(true);
  })

})


serialport.list((err, ports) => {
  console.log('ports', ports);
  if (err) {
    document.getElementById('error').textContent = err.message
    return
  } else {
    document.getElementById('error').textContent = ''
  }

  if (ports.length === 0) {
    document.getElementById('error').textContent = 'No ports discovered'
  }

  const headers = Object.keys(ports[0])
  const table = createTable(headers)
  tableHTML = ''
  table.on('data', data => tableHTML += data)
  table.on('end', () => document.getElementById('ports').innerHTML = tableHTML)
  ports.forEach(port => table.write(port))
  table.end();

})


