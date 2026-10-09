/* =========================================================
   TUX POS — CATEGORY COLORS SETTINGS
   ========================================================= */

function canManageCategoryColors() {

  return (
    typeof getActiveRole === 'function' &&
    getActiveRole() === 'tuxadmin'
  );

}


/* =========================================================
   CATEGORY COLORS SETTINGS UI
   ========================================================= */

function renderCategoryColorsSettings() {

  const container =
    document.getElementById(
      'category-colors-settings'
    );


  if (!container) {
    return;
  }


  const categories = [

    {
      key: 'sandwiches',
      label: 'Sandwiches & Burgers'
    },

    {
      key: 'combos',
      label: 'Combos'
    },

    {
      key: 'fries',
      label: 'Fries & Loaded'
    },

    {
      key: 'hawawshi',
      label: 'Hawawshi'
    },

    {
      key: 'drinks',
      label: 'Drinks'
    },

    {
      key: 'dessert',
      label: 'Zalabya'
    },

    {
      key: 'extras',
      label: 'Extras'
    }

  ];


  const canEdit =
    canManageCategoryColors();


  const allColors =
    getCategoryColors();


  container.innerHTML =
    categories
      .map((category) => {

        const colors =
          allColors &&
          allColors[category.key]
            ? allColors[category.key]
            : null;


        /* =================================================
           1. CATEGORY NAME TEXT COLOR
           ================================================= */

        const titleTextColor =
          colors?.title_text_color ||
          '#ffffff';


        /* =================================================
           2. CATEGORY BACKGROUND COLOR
           ================================================= */

        const titleColor =
          colors?.title_color ||
          '#000000';


        /* =================================================
           3. CATEGORY WIDTH
           Default = 100%
           ================================================= */

        const titleWidth =
          Number(colors?.title_width) > 0
            ? Math.min(
                100,
                Number(colors.title_width)
              )
            : 100;


        /* =================================================
           4. PRODUCT NAME COLOR
           ================================================= */

        const productNameColor =
          colors?.product_name_color ||
          '#ffffff';


        /* =================================================
           5. PRICE COLOR
           ================================================= */

        const priceColor =
          colors?.price_color ||
          '#000000';


        /* =================================================
           6. BOX COLOR
           ================================================= */

        const cardColor =
          colors?.card_color ||
          '#000000';


        /* =================================================
           7. GRADIENT COLOR
           Default = Black
           ================================================= */

        const gradientColor =
          colors?.gradient_color ||
          '#000000';


        /* =================================================
           8. BORDER COLOR
           Controls the upper inside strip.
           ================================================= */

        const borderColor =
          colors?.border_color ||
          '#ffffff';


        return `

          <div
            class="category-color-row"
            data-category="${category.key}"
          >

            <div class="category-color-info">

              <strong>
                Category: ${category.label}
              </strong>

              <span>
                ${category.key}
              </span>

            </div>


            <div class="category-color-controls">


              <!-- =================================================
                   1. CATEGORY NAME
                   ================================================= -->

              <label>
                Category Name

                <input
                  type="color"
                  class="category-color-title-text"
                  value="${titleTextColor}"
                  ${canEdit ? '' : 'disabled'}
                >
              </label>


              <!-- =================================================
                   2. CATEGORY BACKGROUND
                   ================================================= -->

              <label>
                Category Background

                <input
                  type="color"
                  class="category-color-title"
                  value="${titleColor}"
                  ${canEdit ? '' : 'disabled'}
                >
              </label>


              <!-- =================================================
                   3. CATEGORY WIDTH
                   ================================================= -->

              <label>
                Category Width

                <input
                  type="number"
                  class="category-color-title-width"
                  value="${titleWidth}"
                  min="1"
                  max="100"
                  step="1"
                  ${canEdit ? '' : 'disabled'}
                >

                <span>%</span>
              </label>


              <!-- =================================================
                   4. PRODUCT NAME
                   ================================================= -->

              <label>
                Product Name

                <input
                  type="color"
                  class="category-color-product-name"
                  value="${productNameColor}"
                  ${canEdit ? '' : 'disabled'}
                >
              </label>


              <!-- =================================================
                   5. PRICE COLOR
                   ================================================= -->

              <label>
                Price Color

                <input
                  type="color"
                  class="category-color-price"
                  value="${priceColor}"
                  ${canEdit ? '' : 'disabled'}
                >
              </label>


              <!-- =================================================
                   6. BOX COLOR
                   ================================================= -->

              <label>
                Box Color

                <input
                  type="color"
                  class="category-color-card"
                  value="${cardColor}"
                  ${canEdit ? '' : 'disabled'}
                >
              </label>


              <!-- =================================================
                   7. GRADIENT COLOR
                   ================================================= -->

              <label>
                Gradient

                <input
                  type="color"
                  class="category-color-gradient"
                  value="${gradientColor}"
                  ${canEdit ? '' : 'disabled'}
                >
              </label>


              <!-- =================================================
                   8. BORDER COLOR
                   Controls the upper inside strip.
                   ================================================= -->

              <label>
                Border Color

                <input
                  type="color"
                  class="category-color-border"
                  value="${borderColor}"
                  ${canEdit ? '' : 'disabled'}
                >
              </label>


              <!-- =================================================
                   9. SAVE
                   ================================================= -->

              <button
                type="button"
                class="btn-save"
                onclick="saveCategoryColorRow('${category.key}')"
                ${canEdit ? '' : 'disabled'}
              >
                Save
              </button>


              <!-- =================================================
                   10. RESET
                   ================================================= -->

              <button
                type="button"
                class="btn-save"
                onclick="resetCategoryColorRow('${category.key}')"
                ${canEdit ? '' : 'disabled'}
              >
                Reset
              </button>


            </div>

          </div>

        `;

      })
      .join('');

}


/* =========================================================
   SAVE ONE CATEGORY
   ========================================================= */

async function saveCategoryColorRow(category) {

  if (!canManageCategoryColors()) {

    alert(
      'View only - Only Tux Admin can change category colors.'
    );

    return;
  }


  const row =
    document.querySelector(
      `.category-color-row[data-category="${category}"]`
    );


  if (!row) {
    return;
  }


  /* =====================================================
     1. CATEGORY NAME TEXT COLOR
     ===================================================== */

  const titleTextInput =
    row.querySelector(
      '.category-color-title-text'
    );


  /* =====================================================
     2. CATEGORY BACKGROUND COLOR
     ===================================================== */

  const titleInput =
    row.querySelector(
      '.category-color-title'
    );


  /* =====================================================
     3. CATEGORY WIDTH
     ===================================================== */

  const titleWidthInput =
    row.querySelector(
      '.category-color-title-width'
    );


  /* =====================================================
     4. PRODUCT NAME COLOR
     ===================================================== */

  const productNameInput =
    row.querySelector(
      '.category-color-product-name'
    );


  /* =====================================================
     5. PRICE COLOR
     ===================================================== */

  const priceInput =
    row.querySelector(
      '.category-color-price'
    );


  /* =====================================================
     6. BOX COLOR
     ===================================================== */

  const cardInput =
    row.querySelector(
      '.category-color-card'
    );


  /* =====================================================
     7. GRADIENT COLOR
     ===================================================== */

  const gradientInput =
    row.querySelector(
      '.category-color-gradient'
    );


  /* =====================================================
     8. BORDER COLOR
     Upper inside strip.
     ===================================================== */

  const borderInput =
    row.querySelector(
      '.category-color-border'
    );


  if (
    !titleTextInput ||
    !titleInput ||
    !titleWidthInput ||
    !productNameInput ||
    !cardInput ||
    !gradientInput ||
    !priceInput ||
    !borderInput
  ) {

    return;

  }


  /* =====================================================
     CATEGORY WIDTH — %
     ===================================================== */

  const titleWidth =
    Math.min(
      100,
      Math.max(
        1,
        Number(titleWidthInput.value) || 100
      )
    );


  titleWidthInput.value =
    titleWidth;


  /* =====================================================
     SAVE
     ===================================================== */

  const result =
    await saveCategoryColors(

      category,

      titleTextInput.value,

      titleInput.value,

      titleWidth,

      productNameInput.value,

      cardInput.value,

      gradientInput.value,

      priceInput.value,

      borderInput.value

    );


  if (
    !result ||
    result.success !== true
  ) {

    return;

  }


  if (
    typeof applyCategoryColorsToMenu === 'function'
  ) {

    applyCategoryColorsToMenu();

  }


  alert(
    'Category colors saved successfully.'
  );

}


/* =========================================================
   RESET ONE CATEGORY
   ========================================================= */

async function resetCategoryColorRow(category) {

  if (!canManageCategoryColors()) {

    alert(
      'View only - Only Tux Admin can reset category colors.'
    );

    return;

  }


  const confirmed =
    confirm(
      'Reset this category to the default colors?'
    );


  if (!confirmed) {
    return;
  }


  const result =
    await resetCategoryColors(
      category
    );


  if (
    !result ||
    result.success !== true
  ) {

    return;

  }


  renderCategoryColorsSettings();


  if (
    typeof applyCategoryColorsToMenu === 'function'
  ) {

    applyCategoryColorsToMenu();

  }


  alert(
    'Category colors reset successfully.'
  );

}


/* =========================================================
   INITIAL LOAD
   ========================================================= */

async function initializeCategoryColors() {

  await loadCategoryColors();


  renderCategoryColorsSettings();


  if (
    typeof applyCategoryColorsToMenu === 'function'
  ) {

    applyCategoryColorsToMenu();

  }

}


/* =========================================================
   GLOBAL FUNCTIONS
   ========================================================= */

window.renderCategoryColorsSettings =
  renderCategoryColorsSettings;

window.saveCategoryColorRow =
  saveCategoryColorRow;

window.resetCategoryColorRow =
  resetCategoryColorRow;

window.initializeCategoryColors =
  initializeCategoryColors;