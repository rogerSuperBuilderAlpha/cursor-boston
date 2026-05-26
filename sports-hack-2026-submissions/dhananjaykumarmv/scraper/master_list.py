import os
import pandas as pd

# List of 100 top athletes across 6 major sports:
# Soccer (Football), Basketball, American Football, Tennis, Formula 1, and Cricket.
ATHLETES_DATA = [
    # SOCCER / FOOTBALL (17 players)
    {"name": "Kylian Mbappé", "sport": "Soccer", "team": "Real Madrid", "rank": 1, "wikipedia_query": "Kylian Mbappé"},
    {"name": "Lionel Messi", "sport": "Soccer", "team": "Inter Miami", "rank": 2, "wikipedia_query": "Lionel Messi"},
    {"name": "Cristiano Ronaldo", "sport": "Soccer", "team": "Al Nassr", "rank": 3, "wikipedia_query": "Cristiano Ronaldo"},
    {"name": "Erling Haaland", "sport": "Soccer", "team": "Manchester City", "rank": 4, "wikipedia_query": "Erling Haaland"},
    {"name": "Jude Bellingham", "sport": "Soccer", "team": "Real Madrid", "rank": 5, "wikipedia_query": "Jude Bellingham"},
    {"name": "Vinícius Júnior", "sport": "Soccer", "team": "Real Madrid", "rank": 6, "wikipedia_query": "Vinícius Júnior"},
    {"name": "Mohamed Salah", "sport": "Soccer", "team": "Liverpool", "rank": 7, "wikipedia_query": "Mohamed Salah"},
    {"name": "Harry Kane", "sport": "Soccer", "team": "Bayern Munich", "rank": 8, "wikipedia_query": "Harry Kane"},
    {"name": "Kevin De Bruyne", "sport": "Soccer", "team": "Manchester City", "rank": 9, "wikipedia_query": "Kevin De Bruyne"},
    {"name": "Neymar Jr.", "sport": "Soccer", "team": "Al Hilal", "rank": 10, "wikipedia_query": "Neymar"},
    {"name": "Bukayo Saka", "sport": "Soccer", "team": "Arsenal", "rank": 11, "wikipedia_query": "Bukayo Saka"},
    {"name": "Antoine Griezmann", "sport": "Soccer", "team": "Atlético Madrid", "rank": 12, "wikipedia_query": "Antoine Griezmann"},
    {"name": "Victor Osimhen", "sport": "Soccer", "team": "Galatasaray", "rank": 13, "wikipedia_query": "Victor Osimhen"},
    {"name": "Son Heung-min", "sport": "Soccer", "team": "Tottenham Hotspur", "rank": 14, "wikipedia_query": "Son Heung-min"},
    {"name": "Robert Lewandowski", "sport": "Soccer", "team": "Barcelona", "rank": 15, "wikipedia_query": "Robert Lewandowski"},
    {"name": "Luka Modrić", "sport": "Soccer", "team": "Real Madrid", "rank": 16, "wikipedia_query": "Luka Modrić"},
    {"name": "Marcus Rashford", "sport": "Soccer", "team": "Manchester United", "rank": 17, "wikipedia_query": "Marcus Rashford"},

    # BASKETBALL (17 players)
    {"name": "LeBron James", "sport": "Basketball", "team": "Los Angeles Lakers", "rank": 1, "wikipedia_query": "LeBron James"},
    {"name": "Stephen Curry", "sport": "Basketball", "team": "Golden State Warriors", "rank": 2, "wikipedia_query": "Stephen Curry"},
    {"name": "Kevin Durant", "sport": "Basketball", "team": "Phoenix Suns", "rank": 3, "wikipedia_query": "Kevin Durant"},
    {"name": "Giannis Antetokounmpo", "sport": "Basketball", "team": "Milwaukee Bucks", "rank": 4, "wikipedia_query": "Giannis Antetokounmpo"},
    {"name": "Nikola Jokić", "sport": "Basketball", "team": "Denver Nuggets", "rank": 5, "wikipedia_query": "Nikola Jokić"},
    {"name": "Luka Dončić", "sport": "Basketball", "team": "Dallas Mavericks", "rank": 6, "wikipedia_query": "Luka Dončić"},
    {"name": "Joel Embiid", "sport": "Basketball", "team": "Philadelphia 76ers", "rank": 7, "wikipedia_query": "Joel Embiid"},
    {"name": "Jayson Tatum", "sport": "Basketball", "team": "Boston Celtics", "rank": 8, "wikipedia_query": "Jayson Tatum"},
    {"name": "Jimmy Butler", "sport": "Basketball", "team": "Miami Heat", "rank": 9, "wikipedia_query": "Jimmy Butler"},
    {"name": "Anthony Davis", "sport": "Basketball", "team": "Los Angeles Lakers", "rank": 10, "wikipedia_query": "Anthony Davis"},
    {"name": "Ja Morant", "sport": "Basketball", "team": "Memphis Grizzlies", "rank": 11, "wikipedia_query": "Ja Morant"},
    {"name": "Devin Booker", "sport": "Basketball", "team": "Phoenix Suns", "rank": 12, "wikipedia_query": "Devin Booker"},
    {"name": "Damian Lillard", "sport": "Basketball", "team": "Milwaukee Bucks", "rank": 13, "wikipedia_query": "Damian Lillard"},
    {"name": "Shai Gilgeous-Alexander", "sport": "Basketball", "team": "Oklahoma City Thunder", "rank": 14, "wikipedia_query": "Shai Gilgeous-Alexander"},
    {"name": "Victor Wembanyama", "sport": "Basketball", "team": "San Antonio Spurs", "rank": 15, "wikipedia_query": "Victor Wembanyama"},
    {"name": "Kyrie Irving", "sport": "Basketball", "team": "Dallas Mavericks", "rank": 16, "wikipedia_query": "Kyrie Irving"},
    {"name": "Anthony Edwards", "sport": "Basketball", "team": "Minnesota Timberwolves", "rank": 17, "wikipedia_query": "Anthony Edwards"},

    # AMERICAN FOOTBALL (17 players)
    {"name": "Patrick Mahomes", "sport": "American Football", "team": "Kansas City Chiefs", "rank": 1, "wikipedia_query": "Patrick Mahomes"},
    {"name": "Travis Kelce", "sport": "American Football", "team": "Kansas City Chiefs", "rank": 2, "wikipedia_query": "Travis Kelce"},
    {"name": "Lamar Jackson", "sport": "American Football", "team": "Baltimore Ravens", "rank": 3, "wikipedia_query": "Lamar Jackson"},
    {"name": "Aaron Rodgers", "sport": "American Football", "team": "New York Jets", "rank": 4, "wikipedia_query": "Aaron Rodgers"},
    {"name": "Christian McCaffrey", "sport": "American Football", "team": "San Francisco 49ers", "rank": 5, "wikipedia_query": "Christian McCaffrey"},
    {"name": "Josh Allen", "sport": "American Football", "team": "Buffalo Bills", "rank": 6, "wikipedia_query": "Josh Allen (quarterback)"},
    {"name": "Joe Burrow", "sport": "American Football", "team": "Cincinnati Bengals", "rank": 7, "wikipedia_query": "Joe Burrow"},
    {"name": "Justin Jefferson", "sport": "American Football", "team": "Minnesota Vikings", "rank": 8, "wikipedia_query": "Justin Jefferson"},
    {"name": "Jalen Hurts", "sport": "American Football", "team": "Philadelphia Eagles", "rank": 9, "wikipedia_query": "Jalen Hurts"},
    {"name": "Tyreek Hill", "sport": "American Football", "team": "Miami Dolphins", "rank": 10, "wikipedia_query": "Tyreek Hill"},
    {"name": "Dak Prescott", "sport": "American Football", "team": "Dallas Cowboys", "rank": 11, "wikipedia_query": "Dak Prescott"},
    {"name": "Brock Purdy", "sport": "American Football", "team": "San Francisco 49ers", "rank": 12, "wikipedia_query": "Brock Purdy"},
    {"name": "Micah Parsons", "sport": "American Football", "team": "Dallas Cowboys", "rank": 13, "wikipedia_query": "Micah Parsons"},
    {"name": "Nick Bosa", "sport": "American Football", "team": "San Francisco 49ers", "rank": 14, "wikipedia_query": "Nick Bosa"},
    {"name": "T.J. Watt", "sport": "American Football", "team": "Pittsburgh Steelers", "rank": 15, "wikipedia_query": "T.J. Watt"},
    {"name": "Davante Adams", "sport": "American Football", "team": "New York Jets", "rank": 16, "wikipedia_query": "Davante Adams"},
    {"name": "Saquon Barkley", "sport": "American Football", "team": "Philadelphia Eagles", "rank": 17, "wikipedia_query": "Saquon Barkley"},

    # TENNIS (17 players)
    {"name": "Novak Djokovic", "sport": "Tennis", "team": "Serbia (National)", "rank": 1, "wikipedia_query": "Novak Djokovic"},
    {"name": "Rafael Nadal", "sport": "Tennis", "team": "Spain (National)", "rank": 2, "wikipedia_query": "Rafael Nadal"},
    {"name": "Carlos Alcaraz", "sport": "Tennis", "team": "Spain (National)", "rank": 3, "wikipedia_query": "Carlos Alcaraz"},
    {"name": "Jannik Sinner", "sport": "Tennis", "team": "Italy (National)", "rank": 4, "wikipedia_query": "Jannik Sinner"},
    {"name": "Daniil Medvedev", "sport": "Tennis", "team": "Individual Neutral Athletes", "rank": 5, "wikipedia_query": "Daniil Medvedev"},
    {"name": "Alexander Zverev", "sport": "Tennis", "team": "Germany (National)", "rank": 6, "wikipedia_query": "Alexander Zverev"},
    {"name": "Iga Świątek", "sport": "Tennis", "team": "Poland (National)", "rank": 7, "wikipedia_query": "Iga Świątek"},
    {"name": "Aryna Sabalenka", "sport": "Tennis", "team": "Individual Neutral Athletes", "rank": 8, "wikipedia_query": "Aryna Sabalenka"},
    {"name": "Coco Gauff", "sport": "Tennis", "team": "United States (National)", "rank": 9, "wikipedia_query": "Coco Gauff"},
    {"name": "Naomi Osaka", "sport": "Tennis", "team": "Japan (National)", "rank": 10, "wikipedia_query": "Naomi Osaka"},
    {"name": "Stefanos Tsitsipas", "sport": "Tennis", "team": "Greece (National)", "rank": 11, "wikipedia_query": "Stefanos Tsitsipas"},
    {"name": "Holger Rune", "sport": "Tennis", "team": "Denmark (National)", "rank": 12, "wikipedia_query": "Holger Rune"},
    {"name": "Ons Jabeur", "sport": "Tennis", "team": "Tunisia (National)", "rank": 13, "wikipedia_query": "Ons Jabeur"},
    {"name": "Elena Rybakina", "sport": "Tennis", "team": "Kazakhstan (National)", "rank": 14, "wikipedia_query": "Elena Rybakina"},
    {"name": "Jessica Pegula", "sport": "Tennis", "team": "United States (National)", "rank": 15, "wikipedia_query": "Jessica Pegula"},
    {"name": "Nick Kyrgios", "sport": "Tennis", "team": "Australia (National)", "rank": 16, "wikipedia_query": "Nick Kyrgios"},
    {"name": "Taylor Fritz", "sport": "Tennis", "team": "United States (National)", "rank": 17, "wikipedia_query": "Taylor Fritz"},

    # FORMULA 1 (16 drivers)
    {"name": "Lewis Hamilton", "sport": "Formula 1", "team": "Ferrari", "rank": 1, "wikipedia_query": "Lewis Hamilton"},
    {"name": "Max Verstappen", "sport": "Formula 1", "team": "Red Bull Racing", "rank": 2, "wikipedia_query": "Max Verstappen"},
    {"name": "Charles Leclerc", "sport": "Formula 1", "team": "Ferrari", "rank": 3, "wikipedia_query": "Charles Leclerc"},
    {"name": "Lando Norris", "sport": "Formula 1", "team": "McLaren", "rank": 4, "wikipedia_query": "Lando Norris"},
    {"name": "Fernando Alonso", "sport": "Formula 1", "team": "Aston Martin", "rank": 5, "wikipedia_query": "Fernando Alonso"},
    {"name": "George Russell", "sport": "Formula 1", "team": "Mercedes", "rank": 6, "wikipedia_query": "George Russell"},
    {"name": "Carlos Sainz Jr.", "sport": "Formula 1", "team": "Williams", "rank": 7, "wikipedia_query": "Carlos Sainz Jr."},
    {"name": "Sergio Pérez", "sport": "Formula 1", "team": "Red Bull Racing", "rank": 8, "wikipedia_query": "Sergio Pérez"},
    {"name": "Oscar Piastri", "sport": "Formula 1", "team": "McLaren", "rank": 9, "wikipedia_query": "Oscar Piastri"},
    {"name": "Pierre Gasly", "sport": "Formula 1", "team": "Alpine", "rank": 10, "wikipedia_query": "Pierre Gasly"},
    {"name": "Daniel Ricciardo", "sport": "Formula 1", "team": "RB Formula One Team", "rank": 11, "wikipedia_query": "Daniel Ricciardo"},
    {"name": "Alex Albon", "sport": "Formula 1", "team": "Williams", "rank": 12, "wikipedia_query": "Alex Albon"},
    {"name": "Esteban Ocon", "sport": "Formula 1", "team": "Haas", "rank": 13, "wikipedia_query": "Esteban Ocon"},
    {"name": "Yuki Tsunoda", "sport": "Formula 1", "team": "RB Formula One Team", "rank": 14, "wikipedia_query": "Yuki Tsunoda"},
    {"name": "Valtteri Bottas", "sport": "Formula 1", "team": "Kick Sauber", "rank": 15, "wikipedia_query": "Valtteri Bottas"},
    {"name": "Lance Stroll", "sport": "Formula 1", "team": "Aston Martin", "rank": 16, "wikipedia_query": "Lance Stroll"},

    # CRICKET (16 players)
    {"name": "Virat Kohli", "sport": "Cricket", "team": "Royal Challengers Bengaluru", "rank": 1, "wikipedia_query": "Virat Kohli"},
    {"name": "Rohit Sharma", "sport": "Cricket", "team": "Mumbai Indians", "rank": 2, "wikipedia_query": "Rohit Sharma"},
    {"name": "MS Dhoni", "sport": "Cricket", "team": "Chennai Super Kings", "rank": 3, "wikipedia_query": "MS Dhoni"},
    {"name": "Babar Azam", "sport": "Cricket", "team": "Peshawar Zalmi", "rank": 4, "wikipedia_query": "Babar Azam"},
    {"name": "Kane Williamson", "sport": "Cricket", "team": "Gujarat Titans", "rank": 5, "wikipedia_query": "Kane Williamson"},
    {"name": "Steve Smith", "sport": "Cricket", "team": "Sydney Sixers", "rank": 6, "wikipedia_query": "Steve Smith (cricketer)"},
    {"name": "Joe Root", "sport": "Cricket", "team": "England (National)", "rank": 7, "wikipedia_query": "Joe Root"},
    {"name": "Jasprit Bumrah", "sport": "Cricket", "team": "Mumbai Indians", "rank": 8, "wikipedia_query": "Jasprit Bumrah"},
    {"name": "Hardik Pandya", "sport": "Cricket", "team": "Mumbai Indians", "rank": 9, "wikipedia_query": "Hardik Pandya"},
    {"name": "Glenn Maxwell", "sport": "Cricket", "team": "Royal Challengers Bengaluru", "rank": 10, "wikipedia_query": "Glenn Maxwell"},
    {"name": "Pat Cummins", "sport": "Cricket", "team": "Sunrisers Hyderabad", "rank": 11, "wikipedia_query": "Pat Cummins"},
    {"name": "Mitchell Starc", "sport": "Cricket", "team": "Kolkata Knight Riders", "rank": 12, "wikipedia_query": "Mitchell Starc"},
    {"name": "Rashid Khan", "sport": "Cricket", "team": "Gujarat Titans", "rank": 13, "wikipedia_query": "Rashid Khan"},
    {"name": "KL Rahul", "sport": "Cricket", "team": "Lucknow Super Giants", "rank": 14, "wikipedia_query": "KL Rahul"},
    {"name": "Shakib Al Hasan", "sport": "Cricket", "team": "Bangladesh (National)", "rank": 15, "wikipedia_query": "Shakib Al Hasan"},
    {"name": "Rishabh Pant", "sport": "Cricket", "team": "Delhi Capitals", "rank": 16, "wikipedia_query": "Rishabh Pant"}
]


def generate_master_csv(output_dir="data"):
    os.makedirs(output_dir, exist_ok=True)
    df = pd.DataFrame(ATHLETES_DATA)
    output_path = os.path.join(output_dir, "master_athletes.csv")
    df.to_csv(output_path, index=False)
    print(f"Generated master list CSV with {len(df)} athletes at: {output_path}")
    return output_path

if __name__ == "__main__":
    generate_master_csv()
