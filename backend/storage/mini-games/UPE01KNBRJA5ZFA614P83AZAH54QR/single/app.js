const state = {
  payload: null,
  questions: [],
  index: 0,
  score: 0,
  selectedOption: null,
  answered: false
};

const titleEl = document.getElementById('gameTitle');
const subtitleEl = document.getElementById('gameSubtitle');
const modeEl = document.getElementById('modeValue');
const progressEl = document.getElementById('progressValue');
const scoreEl = document.getElementById('scoreValue');
const questionCardEl = document.getElementById('questionCard');
const reloadBtn = document.getElementById('reloadBtn');
const nextBtn = document.getElementById('nextBtn');

function shuffle(values) {
  const items = [...values];
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildVocabularyQuestions(words = []) {
  const validWords = words.filter(item => item?.word && item?.meaning);

  return validWords.map((item, index) => {
    const distractors = shuffle(
      validWords
        .filter((candidate, candidateIndex) => candidateIndex !== index && candidate.meaning !== item.meaning)
        .map(candidate => candidate.meaning)
    ).slice(0, 3);

    const options = shuffle([item.meaning, ...distractors]);
    const correctIndex = options.findIndex(option => option === item.meaning);

    return {
      type: 'vocabulary',
      prompt: `What does "${item.word}" mean?`,
      hint: item.example
        ? `Example: ${item.example}${item.exampleTranslation ? ` - ${item.exampleTranslation}` : ''}`
        : (item.phonetic ? `Pronunciation: ${item.phonetic}` : 'Choose the correct meaning.'),
      options,
      correctIndex,
      explanation: item.wordType ? `Word type: ${item.wordType}` : 'Review the correct meaning before continuing.'
    };
  }).filter(question => question.options.length >= 2);
}

function buildGrammarQuestions(questions = []) {
  return questions
    .map(question => {
      const variation = question?.primaryVariation || question?.variations?.[0];
      if (!variation?.text || !Array.isArray(variation.options) || typeof variation.correctAnswer !== 'number') {
        return null;
      }

      return {
        type: 'grammar',
        prompt: variation.text,
        hint: question.context || 'Choose the best answer.',
        options: variation.options,
        correctIndex: variation.correctAnswer,
        explanation: variation.explanation || 'Review the correct answer before continuing.'
      };
    })
    .filter(Boolean);
}

function updateStats() {
  const total = state.questions.length;
  const current = total ? Math.min(state.index + 1, total) : 0;
  progressEl.textContent = `${current} / ${total}`;
  scoreEl.textContent = String(state.score);
}

function setNextButtonLabel() {
  if (!state.questions.length) {
    nextBtn.textContent = 'Start';
    nextBtn.disabled = true;
    return;
  }

  if (!state.answered) {
    nextBtn.textContent = 'Check answer';
    nextBtn.disabled = state.selectedOption === null;
    return;
  }

  const isLast = state.index >= state.questions.length - 1;
  nextBtn.textContent = isLast ? 'Finish game' : 'Next question';
  nextBtn.disabled = false;
}

function renderResults() {
  const total = state.questions.length;
  questionCardEl.innerHTML = `
    <div class="result-card">
      <h2>Game complete</h2>
      <p>You finished the playable IT fixture using the live SuperStudy launcher payload.</p>
      <div class="result-score">${state.score} / ${total}</div>
      <p>${total ? `Accuracy: ${Math.round((state.score / total) * 100)}%` : 'No questions were generated.'}</p>
    </div>
  `;

  progressEl.textContent = `${total} / ${total}`;
  nextBtn.textContent = 'Replay';
  nextBtn.disabled = false;

  window.parent.postMessage({
    type: 'GAME_COMPLETE',
    summary: {
      message: 'Playable IT fixture completed successfully.',
      correctAnswers: state.score,
      totalQuestions: total
    }
  }, '*');
}

function renderQuestion() {
  const question = state.questions[state.index];
  if (!question) {
    renderResults();
    return;
  }

  updateStats();
  const optionMarkup = question.options
    .map((option, optionIndex) => {
      let classes = 'option-btn';
      if (state.selectedOption === optionIndex) classes += ' selected';
      if (state.answered && optionIndex === question.correctIndex) classes += ' correct';
      if (state.answered && state.selectedOption === optionIndex && optionIndex !== question.correctIndex) classes += ' incorrect';

      return `
        <button
          class="${classes}"
          type="button"
          data-option-index="${optionIndex}"
          ${state.answered ? 'disabled' : ''}
        >
          ${escapeHtml(option)}
        </button>
      `;
    })
    .join('');

  const feedbackMarkup = state.answered
    ? `
      <div class="feedback-panel">
        <strong>${state.selectedOption === question.correctIndex ? 'Correct' : 'Incorrect'}</strong>
        <p>${escapeHtml(question.explanation)}</p>
      </div>
    `
    : '';

  questionCardEl.innerHTML = `
    <div class="question-meta">
      <span>${escapeHtml(question.type)}</span>
      <span>Question ${state.index + 1}</span>
    </div>
    <h2 class="question-text">${escapeHtml(question.prompt)}</h2>
    <p class="question-hint">${escapeHtml(question.hint || '')}</p>
    <div class="options">${optionMarkup}</div>
    ${feedbackMarkup}
  `;

  questionCardEl.querySelectorAll('[data-option-index]').forEach(button => {
    button.addEventListener('click', () => {
      if (state.answered) return;
      state.selectedOption = Number(button.getAttribute('data-option-index'));
      renderQuestion();
      setNextButtonLabel();
    });
  });

  setNextButtonLabel();
}

function initializeGame(payload) {
  const dataType = payload?.dataType === 'grammar'
    ? 'grammar'
    : Array.isArray(payload?.questions) && payload.questions.length > 0 && (!Array.isArray(payload?.words) || payload.words.length === 0)
      ? 'grammar'
      : 'vocabulary';

  const questions = dataType === 'grammar'
    ? buildGrammarQuestions(payload?.questions || [])
    : buildVocabularyQuestions(payload?.words || []);

  state.payload = payload;
  state.questions = questions;
  state.index = 0;
  state.score = 0;
  state.selectedOption = null;
  state.answered = false;

  titleEl.textContent = dataType === 'grammar' ? 'Grammar Sprint' : 'Word Match Sprint';
  subtitleEl.textContent = questions.length > 0
    ? 'Answer each question, then finish the run to report completion back to SuperStudy.'
    : 'Payload loaded, but there were not enough valid items to build a playable quiz.';
  modeEl.textContent = dataType === 'grammar' ? 'Grammar' : 'Vocabulary';

  if (questions.length === 0) {
    progressEl.textContent = '0 / 0';
    scoreEl.textContent = '0';
    questionCardEl.innerHTML = `
      <div class="empty-state">
        <h2>No playable questions</h2>
        <p>The launcher payload arrived, but it did not contain enough valid items for this quiz format.</p>
      </div>
    `;
    nextBtn.textContent = 'Start';
    nextBtn.disabled = true;
    return;
  }

  renderQuestion();
}

reloadBtn?.addEventListener('click', () => {
  window.parent.postMessage({ type: 'GAME_REQUEST_RELOAD' }, '*');
});

nextBtn?.addEventListener('click', () => {
  if (!state.questions.length) return;

  if (!state.answered) {
    if (state.selectedOption === null) return;
    state.answered = true;
    if (state.selectedOption === state.questions[state.index].correctIndex) {
      state.score += 1;
    }
    renderQuestion();
    return;
  }

  if (state.index >= state.questions.length - 1) {
    state.index = state.questions.length;
    renderResults();
    return;
  }

  state.index += 1;
  state.selectedOption = null;
  state.answered = false;
  renderQuestion();
});

window.addEventListener('message', event => {
  if (!event.data || event.data.type !== 'GAME_DATA') return;
  initializeGame(event.data);
});
