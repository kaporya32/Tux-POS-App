/* =========================================================
   TUX POS — SHARED STATE
   All global data lives here.
   Loaded before every other app script.
   ========================================================= */


/* =========================================================
   CURRENT ORDER / SALES
   ========================================================= */

let hawalkRequests = [];
let currentOrder = [];
let kitchenOrders = [];
let completedSales = [];
let expensesList = [];
let gamiyaOrders = [];


/* =========================================================
   SHIFT DATA
   ========================================================= */

let shiftHistory = JSON.parse(
  localStorage.getItem('tuxShiftHistory') || '[]'
);

let currentShift = JSON.parse(
  localStorage.getItem('tuxCurrentShift') || 'null'
);


/* =========================================================
   MONTHLY FINANCE
   ========================================================= */

let monthlyFinance = null;


function getCurrentMonthKey() {

  const now = new Date();

  return (
    now.getFullYear() +
    '-' +
    String(now.getMonth() + 1).padStart(2, '0')
  );

}


function ensureMonthlyFinance() {

  if (
    !monthlyFinance ||
    typeof monthlyFinance !== 'object'
  ) {

    monthlyFinance = {

      monthKey: getCurrentMonthKey(),

      bank: 0,

      overallExpenses: 0,

      overallOrders: 0,

      hurryApp: 0

    };

  }


  if (
    typeof monthlyFinance.monthKey !== 'string' ||
    !monthlyFinance.monthKey
  ) {

    monthlyFinance.monthKey =
      getCurrentMonthKey();

  }


  if (
    typeof monthlyFinance.bank !== 'number'
  ) {

    monthlyFinance.bank =
      Number(monthlyFinance.bank || 0);

  }


  if (
    typeof monthlyFinance.overallExpenses !== 'number'
  ) {

    monthlyFinance.overallExpenses =
      Number(monthlyFinance.overallExpenses || 0);

  }


  if (
    typeof monthlyFinance.overallOrders !== 'number'
  ) {

    monthlyFinance.overallOrders =
      Number(monthlyFinance.overallOrders || 0);

  }


  if (
    typeof monthlyFinance.hurryApp !== 'number'
  ) {

    monthlyFinance.hurryApp =
      Number(monthlyFinance.hurryApp || 0);

  }


  if (
    monthlyFinance.monthlyNetSales !== undefined &&
    (
      !monthlyFinance.bank ||
      monthlyFinance.bank === 0
    )
  ) {

    monthlyFinance.bank =
      Number(
        monthlyFinance.monthlyNetSales || 0
      );

  }


  if (
    Object.prototype.hasOwnProperty.call(
      monthlyFinance,
      'monthlyNetSales'
    )
  ) {

    delete monthlyFinance.monthlyNetSales;

  }

}


ensureMonthlyFinance();


/* =========================================================
   ORDER COUNTER
   ========================================================= */

let orderCounter = Number(
  localStorage.getItem('tuxOrderCounter') || '1'
);


/* =========================================================
PERMISSIONS / ROLES
========================================================= */

let adminAccount = JSON.parse(
localStorage.getItem('tuxAdminAccount') || 'null'
);

let tuxAdminActive = false;

let adminActive = false;



/* =========================================================
   WORKERS DATA
   ========================================================= */

let workersList = JSON.parse(
  localStorage.getItem('tuxWorkersList') || '[]'
);

let activeStaffIds = JSON.parse(
  localStorage.getItem('tuxActiveStaffIds') || '[]'
);

let staffModalMode = 'login';


/* =========================================================
   MENU
   ========================================================= */

let menuItems = {

  sandwiches: [],

  combos: [],

  fries: [],

  hawawshi: [],

  drinks: [],

  dessert: []

};


let extrasItems = [];


const MENU_CATEGORY_LABELS = {

  sandwiches: 'Sandwiches & Burgers',

  combos: 'Combos',

  fries: 'Fries & Loaded',

  hawawshi: 'Hawawshi',

  drinks: 'Drinks',

  dessert: 'Zalabya',

  extras: 'Extras'

};


/* =========================================================
   CATEGORY COLORS
   ========================================================= */

const DEFAULT_CATEGORY_COLORS = {

  sandwiches: {
    title: '#a8323a',
    card: '#e5484d',
    price: '#ff777c'
  },

  combos: {
    title: '#a94f19',
    card: '#e4772e',
    price: '#ff9b58'
  },

  fries: {
    title: '#b18a18',
    card: '#e5b93f',
    price: '#f5cf68'
  },

  hawawshi: {
    title: '#75472d',
    card: '#a96842',
    price: '#d99468'
  },

  drinks: {
    title: '#245f91',
    card: '#3b9bd8',
    price: '#6fc1f2'
  },

  dessert: {
    title: '#85447e',
    card: '#d866a8',
    price: '#ed8ac1'
  },

  extras: {
    title: '#85447e',
    card: '#9b6cff',
    price: '#b99aff'
  }

};


let categoryColors =
  JSON.parse(
    JSON.stringify(
      DEFAULT_CATEGORY_COLORS
    )
  );


let draggedIndex = null;

let draggedCategory = null;


/* =========================================================
   STOCK
   ========================================================= */

let stockInventory = {};


/* =========================================================
   RECIPES
   ========================================================= */

let recipes = {};


/* =========================================================
   MISC UI STATE
   ========================================================= */

let visiblePasswordKeys = {};

let countModalMode = 'start'; 