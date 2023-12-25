const express = require("express");
const app = express();
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcrypt');
const compiler = require('compilex');


const http = require("http");
const jwt = require('jsonwebtoken');
const bodyParser = require('body-parser'); // Add this line

const { Server } = require("socket.io");
const ACTIONS = require("./Actions");

const server = http.createServer(app);
const options = { stats: true }; //prints stats on console 
compiler.init(options);

const io = new Server(server);
app.use(bodyParser.json()); // Add this line
app.use(cors({
  origin: 'http://localhost:3000',
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
  credentials: true,  // enable set cookie
}));

const db = mongoose.connection;


mongoose.connect('mongodb://localhost/code', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});
const User = mongoose.model('User', {
  username: String,
  password: String,
});
const secretKey = 'aqjr0q39rjmq3irneqwrh83w';
app.post('/signup', async (req, res) => {
  const { username, password } = req.body;

  const hashedPassword = await bcrypt.hash(password, 10);

  const user = new User({
    username,
    password: hashedPassword,
  });

  await user.save();
  res.status(201).send('User registered successfully!');
});

app.post('/login', async (req, res) => {
  const { username, password } = req.body;

  const user = await User.findOne({ username });

  if (!user) {
    return res.status(404).send('User not found');
  }

  const isPasswordValid = await bcrypt.compare(password, user.password);

  if (!isPasswordValid) {
    return res.status(401).send('Invalid password');
  }

  const token = jwt.sign({ username: user.username }, secretKey);

  res.cookie('authToken', token, { httpOnly: true });
  res.json({ token });
});

app.post('/editor/:roomId', async (req, res) => {


  console.log('Received request:', req.body);

  var code = req.body.code;
  var input = req.body.input;
  var inputRadio = req.inputRadio;
  var lang = req.body.lang;
  if (lang === "C" || lang === "C++") {
    if (inputRadio === "true") {
      var envData = { OS: "windows", cmd: "g++" }; // (uses g++ command to compile )

      var envData = { OS: "linux", cmd: "gcc", options: { timeout: 10000 } }; // ( uses gcc command to compile )
      compiler.compileCPPWithInput(envData, code, input, function (data) {
        res.send(data);
      });
    }
    else {
      var envData = { OS: "windows", cmd: "g++" }; // (uses g++ command to compile )
      var envData = { OS: "linux", cmd: "gcc", options: { timeout: 10000 } }; // ( uses gcc command to compile )

      compiler.compileCPP(envData, code, function (data) {
        res.send(data);
        // data.error = error message
        // data.output = output value
      });

    }
  } if (lang === "Python") {
    if (inputRadio === "true") {

      //if windows  
      var envData = { OS: "windows" };
      //else
      var envData = { OS: "linux" };
      compiler.compilePythonWithInput(envData, code, input, function (data) {

        res.send("HI", data);
      });

    } else {
      //if windows  
      var envData = { OS: "windows" };
      //else
      var envData = { OS: "linux" };
      compiler.compilePython(envData, code, function (data) {
        console.log(data)
        res.send(data);
      });
    }

  }

})

app.get('/editor/:roomId', async (req, res) => {

  compiler.editor(function (data) {
    // console.log('Code Output:', data);

    res.send(data)
  })
})

const userSocketMap = {};
const getAllConnectedClients = (roomId) => {
  return Array.from(io.sockets.adapter.rooms.get(roomId) || []).map(
    (socketId) => {
      return {
        socketId,
        username: userSocketMap[socketId],
      };
    }
  );
};

const cursors = {}; // Maintain a dictionary of cursors for each user in the room


io.on("connection", (socket) => {
  // console.log('Socket connected', socket.id);
  socket.on(ACTIONS.JOIN, ({ roomId, username }) => {
    userSocketMap[socket.id] = username;
    socket.join(roomId);
    const clients = getAllConnectedClients(roomId);
    // notify that new user join
    clients.forEach(({ socketId }) => {
      io.to(socketId).emit(ACTIONS.JOINED, {
        clients,
        username,
        socketId: socket.id,
      });
      console.log('Connected clients:', clients);

    });
  });
  // Server-side

  // Listen for cursor position updates
  socket.on(ACTIONS.CURSOR_POSITION_UPDATE, ({ roomId, username, x, y }) => {
    // Update the cursor position for the user

    cursors[username] = { x, y };
    socket.in(roomId).emit(ACTIONS.CURSOR_POSITION_UPDATE, { cursors });

    // Broadcast the cursor position to all connected clients in the room except the sender
    // io.in(roomId).emit(ACTIONS.CURSOR_POSITION_UPDATE, {
    //   cursors
    // });
  });

  // When a new user joins, send all existing cursors to that user
  // socket.on(ACTIONS.JOINED, ({ socketId }) => {
  //   // Get all existing cursors
  //   const existingCursors = Object.values(cursors);

  //   // Send the existing cursors to the new user
  //   socket.to(socketId).emit(ACTIONS.ALL_CURSORS_UPDATE, existingCursors);
  // });





  // sync the code
  socket.on(ACTIONS.CODE_CHANGE, ({ roomId, code, }) => {
    socket.in(roomId).emit(ACTIONS.CODE_CHANGE, { code });
  });
  socket.on(ACTIONS.SYNC_CODE, ({ socketId, code }) => {
    io.to(socketId).emit(ACTIONS.CODE_CHANGE, { code });
  });

  // leave room
  socket.on("disconnecting", () => {
    const rooms = [...socket.rooms];
    // leave all the room
    rooms.forEach((roomId) => {
      socket.in(roomId).emit(ACTIONS.DISCONNECTED, {
        socketId: socket.id,
        username: userSocketMap[socket.id],
      });
    });

    delete userSocketMap[socket.id];
    socket.leave();
  });
});

const PORT = 5000; // Use a fixed port number
compiler.flush(function () {
  console.log('All temporary files flushed !');
});

server.listen(PORT, () => console.log(`Server is running on port ${PORT}`));