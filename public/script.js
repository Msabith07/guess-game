const socket = io();

let locked = false;
let countdown;

socket.on("connect", () => {
  console.log("✅ USER connected:", socket.id);

  const username = sessionStorage.getItem("username") || "Guest";
  socket.emit("registerUser", username);
});

socket.on("newQuestion", (data) => {
  console.log("✅ newQuestion received:", data);

  locked = false;
  clearInterval(countdown);

  const { question, time } = data;

  const photo1 = document.getElementById("photo1");
  const photo2 = document.getElementById("photo2");

  photo1.src = question.image1;
  photo2.src = question.image2;
  photo2.style.display = "none";

  document.getElementById("timeText").innerText = time;

  const optionsDiv = document.getElementById("options");
  optionsDiv.innerHTML = "";

  if (!question.options || question.options.length === 0) return;

  // ✅ Shuffle options
  const shuffledOptions = [...question.options];
  for (let i = shuffledOptions.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffledOptions[i], shuffledOptions[j]] = [
      shuffledOptions[j],
      shuffledOptions[i],
    ];
  }

  // ✅ Create buttons
  shuffledOptions.forEach((opt) => {
    const btn = document.createElement("button");
    btn.innerText = opt;

    btn.onclick = () => {
      if (locked) return;
      locked = true;

      // show 2nd image
      photo2.style.display = "block";

      // disable all buttons after one click
      disableAllButtons();

      // send answer to server
      socket.emit("submitAnswer", opt);
    };

    optionsDiv.appendChild(btn);
  });

  startCountdown(time);
});

// ✅ Listen for result from server and apply classes
socket.on("answerResult", (data) => {
  const { chosenAnswer, correctAnswer } = data;

  const buttons = document.querySelectorAll("#options button");

  buttons.forEach((btn) => {
    const optionText = btn.innerText;

    // ✅ always highlight correct answer
    if (optionText === correctAnswer) {
      btn.classList.add("reveal-correct");
    }

    // ✅ highlight chosen answer
    if (optionText === chosenAnswer) {
      if (chosenAnswer === correctAnswer) {
        btn.classList.add("correct");
      } else {
        btn.classList.add("wrong");
      }
    }

    btn.disabled = true;
  });
});

function disableAllButtons() {
  const buttons = document.querySelectorAll("#options button");
  buttons.forEach((btn) => (btn.disabled = true));
}

function startCountdown(time) {
  countdown = setInterval(() => {
    time--;
    document.getElementById("timeText").innerText = time;

    if (time <= 0) {
      clearInterval(countdown);

      // ✅ when time ends, lock input
      locked = true;
      disableAllButtons();
    }
  }, 1000);
}

socket.on("quizEnd", (scores) => {
  console.log("✅ quizEnd received:", scores);
  sessionStorage.setItem("quizResults", JSON.stringify(scores));

  alert("Quiz Finished!");
  window.location.href = "/results.html";
});
