import pandas as pd

# Load drinks dataset
drinks = pd.read_csv("drinks.csv")

def recommend_drinks(preferences):
    scores = {}
    for _, row in drinks.iterrows():
        score = 0
        for feature, pref_value in preferences.items():
            if pref_value and str(row[feature]).lower() == pref_value.lower():
                score += 1
        scores[row["name"]] = score

    # Sort by score
    ranked = sorted(scores.items(), key=lambda x: x[1], reverse=True)
    return [drink for drink, score in ranked if score > 0][:3]  # top 3
