const statusEl = document.getElementById('status');
const completeButton = document.getElementById('complete');

window.addEventListener('message', (event) => {
  if (!event.data || event.data.type !== 'GAME_DATA') return;

  const words = Array.isArray(event.data.words) ? event.data.words.length : 0;
  const questions = Array.isArray(event.data.questions) ? event.data.questions.length : 0;
  statusEl.textContent = `Payload received: ${words} words, ${questions} questions.`;
});

completeButton?.addEventListener('click', () => {
  window.parent.postMessage({
    type: 'GAME_COMPLETE',
    summary: {
      message: 'Mini game bundle completed successfully.',
      correctAnswers: 1,
      totalQuestions: 1,
    },
  }, '*');
});
