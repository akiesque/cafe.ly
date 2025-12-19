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
        title: 'Welcome to Café.ly! What can we do for you today?',
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

// Display current question
function showQuestion() {
    const question = questions[currentStep];
    const questionTitle = document.getElementById('question-title');
    const questionOptions = document.getElementById('question-options');
    
    questionTitle.textContent = question.title;
    
    // Clear previous options
    questionOptions.innerHTML = '';
    
    // Create buttons for each option
    question.options.forEach(option => {
        const button = document.createElement('button');
        button.className = 'option-btn';
        button.textContent = option;
        button.addEventListener('click', () => selectOption(question.key, option));
        questionOptions.appendChild(button);
    });
    
    updateProgress();
}

// Handle option selection
function selectOption(key, value) {
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
    
    // Hide quiz, show results with animation
    quizSection.style.display = 'none';
    resultsSection.style.display = 'block';
    resultsSection.style.opacity = '0';
    resultsSection.style.transform = 'translateY(20px)';
    
    setTimeout(() => {
        resultsSection.style.opacity = '1';
        resultsSection.style.transform = 'translateY(0)';
    }, 50);
    
    window.scrollTo(0, 0);
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

// Initialize app
document.addEventListener('DOMContentLoaded', async () => {
    await loadDrinks();
    
    const backBtn = document.getElementById('back-btn');
    const quizSection = document.getElementById('quiz-section');
    const resultsSection = document.getElementById('results-section');
    
    // Show first question
    showQuestion();
    
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
        
        // Show quiz, hide results
        resultsSection.style.display = 'none';
        quizSection.style.display = 'block';
        showQuestion();
        window.scrollTo(0, 0);
    });
});
