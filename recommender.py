import pandas as pd
from sklearn.metrics.pairwise import cosine_similarity

# Load drinks dataset
drinks = pd.read_csv("drinks.csv")

SIM_FEATURES = ["caffeine", "flavor", "strength"]

HARD_FILTERS = ["temp", "category"]


def recommend_drinks(preferences, top_k=3):
    df = drinks.copy()

    for feature in HARD_FILTERS:
        pref = preferences.get(feature)
        if pref:
            df = df[df[feature].str.lower() == pref.lower()]

    if df.empty:
        df = drinks.copy()

    encoded = pd.get_dummies(df[SIM_FEATURES])

    user_vec = pd.Series(0, index=encoded.columns)

    for feature, value in preferences.items():
        col = f"{feature}_{value}"
        if col in user_vec:
            user_vec[col] = 1

    similarities = cosine_similarity(
        [user_vec.values],
        encoded.values
    )[0]

    df["score"] = similarities

    return (
        df.sort_values("score", ascending=False)
          .head(top_k)["name"]
          .tolist()
    )
