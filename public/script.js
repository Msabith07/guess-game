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

  // ✅ Shuffle options (same as your logic)
  const shuffledOptions = [...question.options];
  for (let i = shuffledOptions.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffledOptions[i], shuffledOptions[j]] = [
      shuffledOptions[j],
      shuffledOptions[i],
    ];
  }

  shuffledOptions.forEach((opt) => {
    const btn = document.createElement("button");
    btn.innerText = opt;

    btn.onclick = () => {
      if (locked) return;
      locked = true;

      // show 2nd image after clicking answer
      photo2.style.display = "block";

      // ✅ send answer to backend (backend checks correct/wrong)
      socket.emit("submitAnswer", opt);

      // ✅ optional: highlight selected answer only (not correct/wrong)
      btn.classList.add("selected");
    };

    optionsDiv.appendChild(btn);
  });

  startCountdown(time);
});

function startCountdown(time) {
  countdown = setInterval(() => {
    time--;
    document.getElementById("timeText").innerText = time;
    if (time <= 0) clearInterval(countdown);
  }, 1000);
}

socket.on("quizEnd", (scores) => {
  console.log("✅ quizEnd received:", scores);
  sessionStorage.setItem("quizResults", JSON.stringify(scores));

  alert("Quiz Finished!");
  window.location.href = "/results.html";
});
