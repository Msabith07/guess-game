const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const db = require("./firebase");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST", "DELETE"]
  }
});

let usedPersonIds = new Set();
let currentCorrectAnswer = null;

const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static("public"));

// ✅ Firestore collection name
const DETAILS_COLLECTION = "details";

function shuffle(array) {
  return array.sort(() => Math.random() - 0.5);
}

function pickCorrectPerson(people) {
  const available = people.filter(p => !usedPersonIds.has(p.id));

  if (available.length === 0) {
    usedPersonIds.clear();
    return people[Math.floor(Math.random() * people.length)];
  }

  return available[Math.floor(Math.random() * available.length)];
}

function generateOptions(correctPerson, people) {
  let wrongOptions = people.filter(
    p => p.gender === correctPerson.gender && p.id !== correctPerson.id
  );

  if (wrongOptions.length < 3) {
    wrongOptions = people.filter(p => p.id !== correctPerson.id);
  }

  wrongOptions = shuffle(wrongOptions).slice(0, 3);

  return shuffle([
    correctPerson.answer,
    ...wrongOptions.map(p => p.answer)
  ]);
}

// ✅ GET all details from Firestore
app.get("/details", async (req, res) => {
  try {
    const snapshot = await db.collection(DETAILS_COLLECTION).get();

    const details = snapshot.docs.map(doc => ({
      id: doc.id, // 🔥 Firestore ID
      ...doc.data()
    }));

    res.json(details);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ✅ POST add detail to Firestore
app.post("/details", async (req, res) => {
  console.log("POST /details hit", req.body);

  try {
    const { answer, image1, image2, gender } = req.body;

    if (!answer || !image1 || !image2 || !gender) {
      return res.status(400).json({ message: "Missing data" });
    }

    const newEntry = {
      answer,
      image1,
      image2,
      gender,
      createdAt: new Date()
    };

    const docRef = await db.collection(DETAILS_COLLECTION).add(newEntry);

    res.status(201).json({
      message: "Data saved successfully",
      data: { id: docRef.id, ...newEntry }
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ✅ DELETE detail from Firestore
app.delete("/details/:id", async (req, res) => {
  try {
    const id = req.params.id; // ✅ string doc id

    const docRef = db.collection(DETAILS_COLLECTION).doc(id);
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
      return res.status(404).json({ message: "Item not found" });
    }

    await docRef.delete();

    res.json({
      message: "Item deleted successfully",
      deleted: { id, ...docSnap.data() }
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// -------- SOCKET QUIZ PART (Firestore version) --------

let currentIndex = 0;
let timer = null;
let users = {};
let finalResults = null;

io.on("connection", socket => {
  console.log("Connected:", socket.id);

  socket.on("registerUser", username => {
    users[socket.id] = {
      username,
      score: 0
    };
    console.log("User registered:", username);
  });

  socket.on("startQuiz", () => {
    currentIndex = 0;
    finalResults = null;
    usedPersonIds.clear();
    sendQuestion();
  });

  socket.on("submitAnswer", answer => {
    if (users[socket.id] && answer === currentCorrectAnswer) {
      users[socket.id].score += 1;
    }
  });

  socket.on("getResults", () => {
    if (finalResults) {
      socket.emit("quizResults", finalResults);
    }
  });

  socket.on("disconnect", () => {
    console.log("Disconnected:", socket.id);
    delete users[socket.id];
  });
});

// ✅ sendQuestion now reads from Firestore
async function sendQuestion() {
  try {
    const snapshot = await db.collection(DETAILS_COLLECTION).get();

    const people = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    if (people.length < 4) {
      console.error("At least 4 entries required");
      return;
    }

    if (usedPersonIds.size >= people.length) {
      finalResults = users;
      io.emit("quizEnd", users);
      return;
    }

    const correctPerson = pickCorrectPerson(people);
    usedPersonIds.add(correctPerson.id);

    currentCorrectAnswer = correctPerson.answer;

    const options = generateOptions(correctPerson, people);

    io.emit("newQuestion", {
      question: {
        image1: correctPerson.image1,
        image2: correctPerson.image2,
        options,
        answer: correctPerson.answer
      },
      time: 15
    });

    clearTimeout(timer);
    timer = setTimeout(sendQuestion, 15000);
  } catch (err) {
    console.error("Error sending question:", err.message);
  }
}

app.get("/ping", (req, res) => {
  res.send("pong");
});


server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
