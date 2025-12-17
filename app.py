from flask import Flask, render_template, request
from recommender import recommend_drinks

app = Flask(__name__)

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/recommend", methods=["POST"])
def recommend():
    # Collect quiz answers
    preferences = {
        "caffeine": request.form.get("caffeine"),
        "temp": request.form.get("temp"),
        "flavor": request.form.get("flavor"),
        "strength": request.form.get("strength"),
    }
    # Get recommendations
    results = recommend_drinks(preferences)
    return render_template("results.html", drinks=results)

if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=True)
