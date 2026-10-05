const { getGameState, setGameState, deleteGameState } = require('../Functions/games-database.js');

const triviaQuestions = [
  { q: "What is the capital of France?", a: ["Paris", "paris"], category: "Geography" },
  { q: "Who painted the Mona Lisa?", a: ["Leonardo da Vinci", "Da Vinci", "leonardo", "davinci"], category: "Art" },
  { q: "What is the largest planet in our solar system?", a: ["Jupiter", "jupiter"], category: "Science" },
  { q: "Who wrote 'Romeo and Juliet'?", a: ["William Shakespeare", "Shakespeare", "shakespeare"], category: "Literature" },
  { q: "What is the smallest country in the world?", a: ["Vatican City", "Vatican", "vatican"], category: "Geography" },
  { q: "What year did World War II end?", a: ["1945"], category: "History" },
  { q: "What is the chemical symbol for gold?", a: ["Au", "au"], category: "Science" },
  { q: "How many continents are there?", a: ["7", "seven", "Seven"], category: "Geography" },
  { q: "Who invented the telephone?", a: ["Alexander Graham Bell", "Graham Bell", "Bell"], category: "History" },
  { q: "What is the fastest land animal?", a: ["Cheetah", "cheetah"], category: "Animals" },
  { q: "What is the largest ocean on Earth?", a: ["Pacific Ocean", "Pacific", "pacific"], category: "Geography" },
  { q: "How many bones are in the human body?", a: ["206"], category: "Science" },
  { q: "What is the hardest natural substance on Earth?", a: ["Diamond", "diamond"], category: "Science" },
  { q: "Who was the first person to walk on the moon?", a: ["Neil Armstrong", "Armstrong"], category: "History" },
  { q: "What is the capital of Japan?", a: ["Tokyo", "tokyo"], category: "Geography" },
  { q: "How many sides does a hexagon have?", a: ["6", "six", "Six"], category: "Math" },
  { q: "What is the largest mammal in the world?", a: ["Blue Whale", "Blue whale", "Whale"], category: "Animals" },
  { q: "What programming language is known for web development?", a: ["JavaScript", "Javascript", "javascript", "JS"], category: "Technology" },
  { q: "What is the currency of the United Kingdom?", a: ["Pound Sterling", "Pound", "GBP"], category: "Economics" },
  { q: "How many players are on a soccer team?", a: ["11", "eleven", "Eleven"], category: "Sports" }
];

module.exports = () => ({
  name: "Trivia Quiz",
  triggers: ["trivia", "quiz"],
  description: "Answer trivia questions and test your knowledge",
  category: "Games",
  react: "🧠",

  run: async ({ m, Cypher, args, text }) => {
    const chatId = m.chat;
    const gameName = 'trivia';
    const gameState = getGameState(chatId, gameName);

    if (args[0] === 'start' || (!gameState && !args[0])) {
      if (gameState) {
        return m.reply("⚠️ *A trivia game is already in progress!* Use `.trivia quit` to end it.");
      }

      const question = triviaQuestions[Math.floor(Math.random() * triviaQuestions.length)];
      const newGame = {
        question: question.q,
        answers: question.a,
        category: question.category,
        askedBy: m.sender,
        startTime: Date.now(),
        attempts: 0
      };

      setGameState(chatId, gameName, newGame);
      return m.reply(
        `🧠 *Trivia Question*\n\n` +
        `📚 *Category:* ${question.category}\n\n` +
        `❓ ${question.q}\n\n` +
        `*Answer:* .trivia <your answer>\n` +
        `*Skip:* .trivia skip\n` +
        `*Quit:* .trivia quit`
      );
    }

    if (args[0] === 'skip' && gameState) {
      const correctAnswer = gameState.answers[0];
      deleteGameState(chatId, gameName);
      return m.reply(
        `⏭️ *Question Skipped!*\n\n` +
        `The correct answer was: *${correctAnswer}*\n\n` +
        `*Next question:* .trivia start`
      );
    }

    if (args[0] === 'quit' || args[0] === 'end') {
      if (!gameState) {
        return m.reply("⚠️ *No active trivia to quit!*");
      }

      const correctAnswer = gameState.answers[0];
      deleteGameState(chatId, gameName);
      return m.reply(
        `❌ *Trivia ended!*\n\n` +
        `The correct answer was: *${correctAnswer}*`
      );
    }

    if (gameState && text) {
      gameState.attempts++;
      const userAnswer = text.trim();
      const isCorrect = gameState.answers.some(
        ans => ans.toLowerCase() === userAnswer.toLowerCase()
      );

      if (isCorrect) {
        const timeTaken = Math.floor((Date.now() - gameState.startTime) / 1000);
        deleteGameState(chatId, gameName);
        
        return m.reply(
          `🎉 *Correct!*\n\n` +
          `✅ @${m.sender.split('@')[0]} got it right!\n\n` +
          `*Answer:* ${gameState.answers[0]}\n` +
          `*Time:* ${timeTaken}s\n` +
          `*Attempts:* ${gameState.attempts}\n\n` +
          `*Next question:* .trivia start`,
          { mentions: [m.sender] }
        );
      }

      setGameState(chatId, gameName, gameState);
      
      return m.reply(
        `❌ *Wrong answer!*\n\n` +
        `Try again or use:\n` +
        `*Skip:* .trivia skip\n` +
        `*Quit:* .trivia quit`
      );
    }

    if (gameState) {
      return m.reply(
        `🧠 *Current Question*\n\n` +
        `📚 *Category:* ${gameState.category}\n\n` +
        `❓ ${gameState.question}\n\n` +
        `*Answer:* .trivia <your answer>`
      );
    }

    return m.reply(
      `🧠 *Trivia Quiz*\n\n` +
      `Test your knowledge!\n\n` +
      `*Start:* .trivia start\n` +
      `*Answer:* .trivia <answer>\n` +
      `*Skip:* .trivia skip`
    );
  }
});