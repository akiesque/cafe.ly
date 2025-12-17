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
        questionContainer.style.opacity = '0';
        questionContainer.style.transform = 'translateY(-20px)';
        
        setTimeout(() => {
            showQuestion();
            questionContainer.style.opacity = '1';
            questionContainer.style.transform = 'translateY(0)';
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
            .map(drink => `<li>${drink}</li>`)
            .join('');
    } else {
        recommendationsList.innerHTML = '<li>No drinks match your preferences. Try adjusting your selections!</li>';
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

// Recommendation logic (ported from Python)
function recommendDrinks(preferences) {
    const scores = {};
    
    for (const drink of drinks) {
        let score = 0;
        
        for (const [feature, prefValue] of Object.entries(preferences)) {
            if (prefValue) {
                // Handle category field which might have a leading space in JSON
                const drinkKey = feature === 'category' ? ' category' : feature;
                const drinkValue = drink[drinkKey] ? String(drink[drinkKey]).trim().toLowerCase() : '';
                const prefValueLower = String(prefValue).toLowerCase();
                
                // Handle "Either" for temperature
                if (feature === 'temp' && prefValueLower === 'either') {
                    score += 1; // Match any temperature
                } else if (drinkValue === prefValueLower) {
                    score += 1;
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
