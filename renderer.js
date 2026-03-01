// Load drinks data
let drinks = [];
let currentStep = 0;
let preferences = {
    caffeine: null,
    temp: null,
    flavor: null,
    strength: null,
    category: null
};

// Questions configuration
const questions = [
    {
        key: 'name',
        title: 'What can we do for you today?',
        options: ['Recommend a drink', 'Find a coffee shop']
    },
    {
        key: 'caffeine',
        title: 'How much caffeine do you want?',
        options: ['High', 'Medium', 'Low', 'None']
    },
    {
        key: 'temp',
        title: 'What temperature do you prefer?',
        options: ['Hot', 'Cold', 'Either']
    },
    {
        key: 'flavor',
        title: 'What flavor profile appeals to you?',
        options: ['Bitter', 'Sweet', 'Creamy', 'Fruity', 'Nutty', 'Chocolatey', 'Spicy', 'Earthy']
    },
    {
        key: 'strength',
        title: 'How strong do you like your drink?',
        options: ['Light', 'Medium', 'Strong']
    },
    {
        key: 'category',
        title: 'What type of drink?',
        options: ['Coffee', 'Non-coffee']
    }
];

// Load drinks.json on page load
async function loadDrinks() {
    try {
        const response = await fetch('drinks.json');
        drinks = await response.json();
    } catch (error) {
        console.error('Error loading drinks:', error);
        alert('Error loading drinks data. Please make sure drinks.json exists.');
    }
}

// Update progress indicator
function updateProgress() {
    const progressFill = document.getElementById('progress-fill');
    const progressText = document.getElementById('progress-text');
    const totalQuestions = questions.length;
    const progress = ((currentStep + 1) / totalQuestions) * 100;
    
    progressFill.style.width = `${progress}%`;
    progressText.textContent = `Question ${currentStep + 1} of ${totalQuestions}`;
}

// Scroll step for arrow navigation (when >= 4 choices)
const OPTIONS_SCROLL_STEP = 260;

// Display current question
function showQuestion() {
    const question = questions[currentStep];
    const questionTitle = document.getElementById('question-title');
    const questionOptions = document.getElementById('question-options');
    const optionsScrollWrap = document.getElementById('options-scroll-wrap');
    const navArrows = document.getElementById('nav-arrows');
    
    questionTitle.textContent = question.title;
    
    // Clear previous options
    questionOptions.innerHTML = '';
    questionOptions.classList.remove('has-many-choices');
    questionOptions.classList.remove('two-choices');
    navArrows.classList.remove('nav-arrows-visible');
    if (optionsScrollWrap) optionsScrollWrap.scrollLeft = 0;
    
    // Create buttons for each option
    question.options.forEach(option => {
        const button = document.createElement('button');
        button.className = 'option-btn';
        const label = document.createElement('span');
        label.className = 'btn-label';
        label.textContent = option;
        button.appendChild(label);
        button.addEventListener('click', () => selectOption(question.key, option));
        questionOptions.appendChild(button);
    });
    
    // Layout tweaks based on number of choices
    const optionCount = question.options.length;

    // Show arrow buttons and horizontal scroll when 4+ choices; hide scrollbar
    if (optionCount >= 4) {
        questionOptions.classList.add('has-many-choices');
        navArrows.classList.add('nav-arrows-visible');
        navArrows.setAttribute('aria-hidden', 'false');
    } else {
        navArrows.setAttribute('aria-hidden', 'true');
    }

    // When there are exactly 2 choices, center the buttons
    if (optionCount === 2) {
        questionOptions.classList.add('two-choices');
    }
    
    updateProgress();
}

// Handle option selection
function selectOption(key, value) {
    // Special case: user wants to find a coffee shop instead of a drink recommendation
    if (key === 'name' && value === 'Find a coffee shop') {
        startCoffeeShopFlow();
        return;
    }

    preferences[key] = value;
    
    // Move to next question or show results
    if (currentStep < questions.length - 1) {
        currentStep++;
        // Smooth transition
        const questionContainer = document.querySelector('.question-container');
        questionContainer.classList.add('fade-out');
        
        setTimeout(() => {
            showQuestion();
            questionContainer.classList.remove('fade-out');
            questionContainer.classList.add('fade-in');
        }, 200);
    } else {
        // All questions answered, show results
        showResults();
    }
}

// Show results
function showResults() {
    const quizSection = document.getElementById('quiz-section');
    const resultsSection = document.getElementById('results-section');
    const recommendationsList = document.getElementById('recommendations-list');
    
    // Get recommendations
    const recommendations = recommendDrinks(preferences);
    
    // Display results
    if (recommendations.length > 0) {
        recommendationsList.innerHTML = recommendations
            .map(drink => `<li class="recommendation-item">${drink}</li>`)
            .join('');
    } else {
        recommendationsList.innerHTML = '<li class="recommendation-item">No drinks match your preferences. Try adjusting your selections!</li>';
    }
    
    // Hide quiz and arrow nav, show results with animation
    quizSection.style.display = 'none';
    const navArrows = document.getElementById('nav-arrows');
    if (navArrows) {
        navArrows.classList.remove('nav-arrows-visible');
        navArrows.setAttribute('aria-hidden', 'true');
    }
    resultsSection.style.display = 'block';
    resultsSection.style.opacity = '0';
    resultsSection.style.transform = 'translateY(20px)';
    
    setTimeout(() => {
        resultsSection.style.opacity = '1';
        resultsSection.style.transform = 'translateY(0)';
    }, 50);
    
    window.scrollTo(0, 0);
}

// Coffee shop finder flow (OSM backend, via preload -> window.api.findCoffee)
async function startCoffeeShopFlow() {
    const hasNewApi = window.api && typeof window.api.findCoffee === 'function';
    const hasLegacyApi = window.coffeeFinder && typeof window.coffeeFinder.search === 'function';
    if (!hasNewApi && !hasLegacyApi) {
        alert('Coffee finder is not available right now.');
        return;
    }

    const quizSection = document.getElementById('quiz-section');
    const resultsSection = document.getElementById('results-section');
    const coffeeFinderUi = document.getElementById('coffee-finder-ui');
    const addressInput = document.getElementById('coffee-finder-address');
    const searchBtn = document.getElementById('coffee-finder-search-btn');
    const resultsList = document.getElementById('coffee-finder-results');
    const mapContainer = document.getElementById('coffee-finder-map');
    const cardInner = document.querySelector('.card-inner');

    let mapInitialized = false;

    // Show the coffee-finder UI, hide quiz/results
    quizSection.style.display = 'none';
    resultsSection.style.display = 'none';
    coffeeFinderUi.style.display = 'block';
    if (cardInner) {
        cardInner.classList.add('card-inner--coffee');
    }
    document.body.classList.add('coffee-mode');

    async function runSearch() {
        const addr = addressInput.value.trim();
        if (!addr) return;

        resultsList.innerHTML = '<li class="recommendation-item">Searching for nearby coffee shops...</li>';

        try {
            let data;
            if (window.api && typeof window.api.findCoffee === 'function') {
                data = await window.api.findCoffee(addr);
            } else if (window.coffeeFinder && typeof window.coffeeFinder.search === 'function') {
                // Backwards-compatible: legacy API returned a flat array.
                const shopsLegacy = await window.coffeeFinder.search(addr);
                data = {
                    user: null,
                    results: Array.isArray(shopsLegacy) ? shopsLegacy : [],
                };
            } else {
                throw new Error('Coffee finder API is not available.');
            }

            if (data && data.error === 'osm_overpass_busy') {
                const friendly = data.message || 'The coffee shop map is busy right now. Please try again in a minute.';
                resultsList.innerHTML = `<li class="recommendation-item">${friendly}</li>`;
                return;
            }

            const user = data && data.user;
            const shops = Array.isArray(data && data.results) ? data.results : [];

            if (!shops.length) {
                resultsList.innerHTML = '<li class="recommendation-item">No coffee shops found.</li>';
                return;
            }

            if (mapContainer && window.cafeMap && typeof window.cafeMap.initMap === 'function') {
                const centerLat = user && typeof user.lat === 'number' ? user.lat : shops[0].latitude;
                const centerLon = user && typeof user.lon === 'number' ? user.lon : shops[0].longitude;
                if (typeof centerLat === 'number' && typeof centerLon === 'number') {
                    window.cafeMap.initMap(centerLat, centerLon);
                    mapInitialized = true;
                }
            }

            if (mapInitialized && window.cafeMap && typeof window.cafeMap.clearMarkers === 'function') {
                window.cafeMap.clearMarkers();
            }

            const openingStatusFromShop = (shop) => {
                const oh = shop && shop.opening_hours;
                if (!oh) return 'No data';
                if (oh.status) return oh.status;
                if (oh.is_open_now === true) return 'Open now';
                if (oh.is_open_now === false) return 'Closed';
                return 'No data';
            };

            const iconLineFromShop = (shop) => {
                const icons = Array.isArray(shop.amenity_icons) ? shop.amenity_icons : [];
                return icons.length ? icons.join(' ') : '☕';
            };

            const shopsWithIds = shops.map((shop, index) => ({
                ...shop,
                _id: String(shop.id ?? index),
            }));

            // Add markers for each shop.
            if (mapInitialized && window.cafeMap && typeof window.cafeMap.addMarker === 'function') {
                shopsWithIds.forEach((shop) => {
                    if (typeof shop.latitude === 'number' && typeof shop.longitude === 'number') {
                        window.cafeMap.addMarker(
                            shop.latitude,
                            shop.longitude,
                            shop.name || 'Coffee shop',
                            {
                                id: shop._id,
                            }
                        );
                    }
                });
            }

            resultsList.innerHTML = shopsWithIds.map((shop) => {
                const name = shop.name || 'Coffee shop';
                const addressText = shop.address || '';
                const openingStatus = openingStatusFromShop(shop);
                const icons = iconLineFromShop(shop);
                const distance_m = typeof shop.distance_m === 'number' ? shop.distance_m : null;
                const distanceText = distance_m != null
                    ? `${(distance_m / 1000).toFixed(2)} km away`
                    : '';

                return `
                    <li class="recommendation-item coffee-shop-item" data-shop-id="${shop._id}">
                        <div class="coffee-shop-item-header">
                            <strong>${name}</strong>
                            <span class="coffee-shop-amenities">${icons}</span>
                        </div>
                        <div class="coffee-shop-status">${openingStatus}${distanceText ? ` • ${distanceText}` : ''}</div>
                        ${addressText ? `<div>${addressText}</div>` : ''}
                    </li>
                `;
            }).join('');

            // Wire up click -> highlight marker.
            if (mapInitialized && window.cafeMap && typeof window.cafeMap.highlightMarker === 'function') {
                const items = resultsList.querySelectorAll('.coffee-shop-item');
                items.forEach((item) => {
                    item.addEventListener('click', () => {
                        const id = item.getAttribute('data-shop-id');
                        if (!id) return;

                        // Visually mark active item.
                        resultsList
                            .querySelectorAll('.coffee-shop-item--active')
                            .forEach((el) => el.classList.remove('coffee-shop-item--active'));
                        item.classList.add('coffee-shop-item--active');

                        window.cafeMap.highlightMarker(id);
                    });
                });
            }

            window.scrollTo(0, 0);
        } catch (error) {
            console.error('Error finding coffee shops:', error);
            resultsList.innerHTML = '<li class="recommendation-item">Error finding coffee shops. Please try again later.</li>';
        }
    }

    // Attach once
    if (!searchBtn._coffeeFinderBound) {
        searchBtn.addEventListener('click', runSearch);
        searchBtn._coffeeFinderBound = true;
    }
}

// Categorize caffeine based on mg value
function categorizeCaffeine(mg) {
    if (mg === null || mg === undefined || mg === 0) {
        return "None";
    } else if (mg > 100) {
        return "High";
    } else if (mg >= 40) {
        return "Medium";
    } else if (mg > 0) {
        return "Low";
    } else {
        return "None";
    }
}

// Get caffeine category for a drink (uses caffeine_mg if available, otherwise uses caffeine field)
function getCaffeineCategory(drink) {
    // If caffeine_mg exists, categorize it
    if (drink.caffeine_mg !== null && drink.caffeine_mg !== undefined) {
        return categorizeCaffeine(drink.caffeine_mg);
    }
    // Otherwise use the existing caffeine category
    return drink.caffeine || "None";
}

// Recommendation logic (ported from Python)
function recommendDrinks(preferences) {
    const scores = {};
    
    for (const drink of drinks) {
        let score = 0;
        
        for (const [feature, prefValue] of Object.entries(preferences)) {
            if (prefValue) {
                const prefValueLower = String(prefValue).toLowerCase();
                
                // Handle caffeine specially - use caffeine_mg if available
                if (feature === 'caffeine') {
                    const drinkCaffeineCategory = getCaffeineCategory(drink);
                    const drinkCaffeineLower = drinkCaffeineCategory.toLowerCase();
                    
                    if (prefValueLower === 'none') {
                        if (drinkCaffeineLower === 'none' || drink.caffeine_mg === null || drink.caffeine_mg === 0) {
                            score += 1;
                        }
                    } else if (drinkCaffeineLower === prefValueLower) {
                        score += 1;
                    }
                }
                // Handle category field which might have a leading space in JSON
                else if (feature === 'category') {
                    const drinkKey = ' category';
                    const drinkValue = drink[drinkKey] ? String(drink[drinkKey]).trim().toLowerCase() : '';
                    if (drinkValue === prefValueLower) {
                        score += 1;
                    }
                }
                // Handle "Either" for temperature
                else if (feature === 'temp' && prefValueLower === 'either') {
                    score += 1; // Match any temperature
                }
                // Standard matching
                else {
                    const drinkValue = drink[feature] ? String(drink[feature]).trim().toLowerCase() : '';
                    if (drinkValue === prefValueLower) {
                        score += 1;
                    }
                }
            }
        }
        
        scores[drink.name] = score;
    }
    
    // Sort by score and return top 3 matches
    const ranked = Object.entries(scores)
        .sort((a, b) => b[1] - a[1])
        .filter(([_, score]) => score > 0)
        .slice(0, 3)
        .map(([drink, _]) => drink);
    
    return ranked;
}

// Scroll options left/right (used when >= 4 choices)
function scrollOptions(direction) {
    const navArrows = document.getElementById('nav-arrows');
    const optionsScrollWrap = document.getElementById('options-scroll-wrap');
    const questionOptions = document.getElementById('question-options');
    if (!navArrows || !optionsScrollWrap || !questionOptions || !questionOptions.classList.contains('has-many-choices')) return;
    const step = direction === 'left' ? -OPTIONS_SCROLL_STEP : OPTIONS_SCROLL_STEP;
    optionsScrollWrap.scrollBy({ left: step, behavior: 'smooth' });
}

// Initialize app
document.addEventListener('DOMContentLoaded', async () => {
    await loadDrinks();
    
    const backBtn = document.getElementById('back-btn');
    const startBtn = document.getElementById('start-btn');
    const startSection = document.getElementById('start-section');
    const quizSection = document.getElementById('quiz-section');
    const resultsSection = document.getElementById('results-section');
    
    // Start on welcome screen; quiz appears after clicking Start
    quizSection.style.display = 'none';
    startSection.style.display = 'block';
    
    // Arrow buttons: scroll choices left/right when >= 4 options
    document.getElementById('nav-arrow-left').addEventListener('click', () => scrollOptions('left'));
    document.getElementById('nav-arrow-right').addEventListener('click', () => scrollOptions('right'));

    // Start button -> show quiz and first question
    startBtn.addEventListener('click', () => {
        startSection.style.display = 'none';
        quizSection.style.display = 'block';
        currentStep = 0;
        showQuestion();
    });
    
    // Handle back button
    backBtn.addEventListener('click', () => {
        // Reset state
        currentStep = 0;
        preferences = {
            caffeine: null,
            temp: null,
            flavor: null,
            strength: null,
            category: null
        };

        const cardInner = document.querySelector('.card-inner');
        if (cardInner) {
            cardInner.classList.remove('card-inner--coffee');
        }
        document.body.classList.remove('coffee-mode');

        // Show quiz, hide results
        resultsSection.style.display = 'none';
        quizSection.style.display = 'block';
        showQuestion();
        window.scrollTo(0, 0);
    });
});
