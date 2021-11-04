import axios from 'axios';
import render from '../view/render.js';
import '../../scss/style.scss';
import state from '../store/state.js';
import { createDropZone, createCategory, createLinkCard } from './Kanban.js';
import fetchCharts from './statistics.js';
import { getRandomElements } from '../utils/helper.js';

// DOM Nodes
const $sidebar = document.querySelector('.sidebar');
const $form = document.querySelector('.sidebar__form');

// Variables
const validUrlRegExp =
  /((((https?:\/\/)?)((www).)?\.[A-Za-z0-9.-]+)((?:\/[+~%/.\w-_]*)?\??(?:[-+=&;%@.\w_]*)#?(?:[\w]*))?)/;

// state
// let store = [];

// Functions
const generateCategoryId = () =>
  Math.max(...state.categories.map(category => category.id), 0) + 1;

const generateLinkCardId = () =>
  Math.max(...state.allLinks.map(link => link.id), 0) + 1;

const setStore = newStore => {
  state.setCategories(newStore);

  const $categories = state.categories.map(categoryData =>
    createCategory(categoryData)
  );
  const $cards = state.categories.map(({ id: categoryId, items }) =>
    items.map(cardData => createLinkCard({ ...cardData, categoryId }))
  );

  render.mainPage($categories, $cards);
  fetchCharts();
  document.querySelector('.kanban__add-button').onclick = addCategory;
};

const deleteCategory = async id => {
  try {
    const { data: newStore } = await axios.delete(`/store/${id}`);

    setStore(newStore);
  } catch (e) {
    console.error(e);
  }
};

const fetchCategory = async () => {
  document
    .querySelector('.sidebar__form ~ [data-id="0"]')
    .querySelector('.kanban__column-items')
    .appendChild(createDropZone());

  try {
    const { data: newStore } = await axios.get('/store');

    setStore(newStore);
  } catch (e) {
    console.error(e);
  }
};

const addCategory = async () => {
  try {
    const { data: newStore } = await axios.post('/store', {
      id: generateCategoryId(),
      title: 'New Category',
      items: []
    });

    setStore(newStore);
  } catch (e) {
    console.error(e);
  }
};

const addLink = async url => {
  try {
    const { data: newStore } = await axios.post('/store/link', {
      url,
      id: generateLinkCardId()
    });

    setStore(newStore);
  } catch (e) {
    console.error(e);
  }
};

// Event
window.addEventListener('DOMContentLoaded', fetchCategory);

window.ondrop = async e => {
  if (!e.target.matches('.kanban__dropzone')) return;
  e.preventDefault();
  e.target.classList.remove('active');

  const cardId = e.dataTransfer.getData('text/plain');
  const $toBePlacedCard = document.querySelector(`li[data-id="${cardId}"]`);

  if ($toBePlacedCard.contains(e.target)) return;

  const [$currentCategory, $toBePlacedCategory] = [
    $toBePlacedCard,
    e.target
  ].map(el => el.closest('.kanban__column'));

  const [currentCategoryId, toBePlacedCategoryId] = [
    $currentCategory,
    $toBePlacedCategory
  ].map(el => el.dataset.id);

  const currentCardIndex = [
    ...$currentCategory.querySelectorAll('.kanban__item')
  ].indexOf($toBePlacedCard);

  const toBePlacedCardIndex = [
    ...$toBePlacedCategory.querySelectorAll('.kanban__dropzone')
  ].indexOf(e.target);

  try {
    const { data: newStore } =
      +cardId === 0
        ? await axios.post(
            `/store/${toBePlacedCategoryId}/${toBePlacedCardIndex}`,
            {
              url: $toBePlacedCard.querySelector('a').href,
              id: generateLinkCardId()
            }
          )
        : await axios.patch(`/store/${currentCategoryId}/${currentCardIndex}`, {
            toBePlacedCategoryId,
            toBePlacedCardIndex
          });

    const $recommendDiv = document.querySelector('.recommend');
    const $button = $recommendDiv.firstElementChild;
    $recommendDiv.innerHTML = '';
    $recommendDiv.appendChild($button);
    $recommendDiv.classList.remove('active');

    setStore(newStore);
  } catch (e) {
    console.error(e);
  }
};

window.onclick = e => {
  if (!e.target.matches('.kanban__column-delete')) return;

  deleteCategory(e.target.parentNode.dataset.id);
};

// 사이드바 이벤트
$sidebar.ondragover = e => {
  e.preventDefault();
  if (!e.target.matches('.sidebar, .sidebar *')) return;
  $sidebar.classList.add('active');
};

$sidebar.ondragleave = e => {
  e.preventDefault();
  $sidebar.classList.remove('active');
};

$form.onsubmit = e => {
  e.preventDefault();
  const $input = e.target.querySelector('.sidebar__input');
  if (!validUrlRegExp.test($input.value)) {
    $input.classList.add('sidebar__input--error');
    document.querySelector('.sidebar__error-msg').textContent =
      '유효하지 않은 URL입니다.';
    return;
  }
  $input.classList.remove('sidebar__input--error');
  document.querySelector('.sidebar__error-msg').textContent = '';
  addLink($input.value);
  $input.value = '';
};

document.querySelector('.recommend__button').onclick = async e => {
  const $recommendDiv = e.target.closest('.recommend');
  if ($recommendDiv.classList.contains('active')) {
    const $button = $recommendDiv.firstElementChild;
    $recommendDiv.innerHTML = '';
    $recommendDiv.appendChild($button);
    $recommendDiv.classList.remove('active');
    return;
  }

  // recommend.js에서 import하기
  const getRecommendSiteCard = async keywords => {
    if (keywords.length < 2) {
      const $noHashMsg = document.createElement('p');
      $noHashMsg.classList.add('noHashMsg');
      $noHashMsg.textContent = '해시태그로 추천사이트를 받아보세요';
      return $noHashMsg;
    }

    try {
      const { data: cardData } = await axios.get(
        `/recommend/${getRandomElements(keywords).join('+')}`
      );
      return createLinkCard(cardData);
    } catch (e) {
      console.error(e);
    }
  };
  $recommendDiv.classList.add('loading');
  const $recommendSiteCard = await getRecommendSiteCard(state.hashtags);
  $recommendDiv.classList.remove('loading');
  $recommendDiv.appendChild($recommendSiteCard);
  $recommendDiv.classList.add('active');
};

// window.addEventListener('paste', e => {
//   // Stop data actually being pasted into div
//   e.stopPropagation();
//   e.preventDefault();

//   // Get pasted data via clipboard API
//   const clipboardData = e.clipboardData || window.clipboardData;
//   const pastedData = clipboardData.getData('Text');

//   if (!validUrlRegExp.test(pastedData)) {
//     alert('유효하지 않은 URL입니다.');
//     return;
//   }

//   // @todo: Do something
//   alert(`붙여 넣은 데이터: ${pastedData}`);
//   // addLink(pastedData);
// });

$sidebar.onclick = e => {
  if (!e.target.parentNode.matches('.sidebar__button')) return;

  const isTarget = regex => !e.target.parentNode.className.match(regex, 'g');

  [...document.querySelectorAll('main')].forEach($main => {
    $main.classList.toggle(
      'hidden',
      isTarget(new RegExp($main.classList[0], 'g'))
    );
    $main.hidden = isTarget(new RegExp($main.classList[0], 'g'));
  });

  if (e.target.parentNode.matches('.sidebar__button--statistics'))
    fetchCharts();
};

window.ondblclick = e => {
  if (!e.target.matches('.kanban__column-title')) return;

  const $input = e.target.parentNode.querySelector('.edit');
  $input.value = e.target.textContent;
  $input.hidden = false;
  $input.focus();
  $input.setSelectionRange(0, $input.value.length);
};

window.onkeyup = async e => {
  if (!e.target.matches('.edit') || e.key !== 'Enter') return;

  const categoryId = e.target.closest('.kanban__column').dataset.id;

  if (e.target.value.trim() === '') {
    e.target.hidden = true;
    return;
  }

  try {
    const { data: newStore } = await axios.patch(`/store/${categoryId}`, {
      title: e.target.value.trim()
    });

    setStore(newStore);
  } catch (e) {
    console.error(e);
  }
};
