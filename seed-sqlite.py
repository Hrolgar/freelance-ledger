#!/usr/bin/env python3
"""Seed FreelanceLedger SQLite database directly."""
import sqlite3

DB = "/mnt/hrolbot-ssd/projects/freelance-ledger/src/FreelanceLedger.Api/ledger.db"
conn = sqlite3.connect(DB)
c = conn.cursor()

# Enum mappings (match C# enum order)
PLATFORM = {"Freelancer": 0, "Upwork": 1, "Direct": 2, "Other": 3}
CURRENCY = {"GBP": 0, "USD": 1, "EUR": 2, "CAD": 3, "INR": 4, "NOK": 5}
PROJECT_STATUS = {"Quoted": 0, "Awarded": 1, "InProgress": 2, "Completed": 3, "Paid": 4}
MILESTONE_STATUS = {"Pending": 0, "Funded": 1, "Released": 2, "Paid": 3, "Disputed": 4}
COST_CATEGORY = {"Software": 0, "Hardware": 1, "Internet": 2, "Office": 3, "Other": 4}

def insert_project(client, name, platform, currency, fee_pct, status, awarded=None, completed=None, notes=None):
    c.execute("""INSERT INTO Projects (ClientName, ProjectName, Platform, Currency, FeePercentage, Status, DateAwarded, DateCompleted, Notes)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
              (client, name, PLATFORM[platform], CURRENCY[currency], str(fee_pct), PROJECT_STATUS[status], awarded, completed, notes))
    return c.lastrowid

def insert_milestone(project_id, name, amount, currency, status, sort_order, date_paid=None, date_due=None):
    c.execute("""INSERT INTO Milestones (ProjectId, Name, Description, Amount, Currency, Status, DateDue, DatePaid, SortOrder)
                 VALUES (?, ?, NULL, ?, ?, ?, ?, ?, ?)""",
              (project_id, name, str(amount), CURRENCY[currency], MILESTONE_STATUS[status], date_due, date_paid, sort_order))

def insert_tip(project_id, amount, currency, date, notes=None):
    c.execute("""INSERT INTO Tips (ProjectId, Amount, Currency, Date, Notes)
                 VALUES (?, ?, ?, ?, ?)""",
              (project_id, str(amount), CURRENCY[currency], date, notes))

def insert_cost(desc, amount, currency, category, month, year, recurring, notes=None, end_month=None, end_year=None):
    c.execute("""INSERT INTO Costs (Description, Amount, Currency, Category, Month, Year, Recurring, EndMonth, EndYear, Notes)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
              (desc, str(amount), CURRENCY[currency], COST_CATEGORY[category], month, year, 1 if recurring else 0, end_month, end_year, notes))

def insert_investment(desc, amount, currency, nok_rate, month, year, notes=None):
    c.execute("""INSERT INTO Investments (Description, Amount, Currency, NokRate, Month, Year, Notes)
                 VALUES (?, ?, ?, ?, ?, ?, ?)""",
              (desc, str(amount), CURRENCY[currency], str(nok_rate), month, year, notes))

def insert_rate(currency, month, year, rate):
    c.execute("""INSERT OR REPLACE INTO ExchangeRates (Currency, Month, Year, Rate)
                 VALUES (?, ?, ?, ?)""",
              (CURRENCY[currency], month, year, str(rate)))

print("Seeding exchange rates...")
for cur, rates in [
    ("GBP", [(3, 12.93), (4, 12.92)]),
    ("USD", [(3, 9.78), (4, 9.77)]),
    ("EUR", [(3, 11.22), (4, 11.22)]),
    ("CAD", [(3, 7.01), (4, 7.01)]),
    ("INR", [(3, 0.10), (4, 0.1045)]),
]:
    for month, rate in rates:
        insert_rate(cur, month, 2026, rate)

print("Seeding projects...")

# 1. Nick — Original bot (£180, 2x£90)
pid = insert_project("nick111nick111", "Claude Code Investment Bot", "Freelancer", "GBP", 10, "Paid", "2026-03-31", "2026-03-31", "First freelance delivery. Project ID 40332834.")
insert_milestone(pid, "Milestone 1", 90, "GBP", "Paid", 1, date_paid="2026-03-31")
insert_milestone(pid, "Milestone 2", 90, "GBP", "Paid", 2, date_paid="2026-03-31")
insert_tip(pid, 9, "GBP", "2026-03-31", "Tip from Nick")

# 2. Nick — Fallback RPC upgrade (£87.55)
pid = insert_project("nick111nick111", "TaoBot Upgrade — Fallback RPC", "Freelancer", "GBP", 10, "Paid", "2026-04-03", "2026-04-04", "Project ID 40346281. Bulk query, cycle 200s→7s.")
insert_milestone(pid, "Fallback RPC upgrade", 87.55, "GBP", "Paid", 1, date_paid="2026-04-04")
insert_tip(pid, 8.50, "GBP", "2026-04-04", "Tip from Nick")

# 3. Nick — Surge Alerts + Ranking (£80)
pid = insert_project("nick111nick111", "Surge Alerts + Subnet Ranking", "Freelancer", "GBP", 10, "InProgress", "2026-04-07", None, "£80 milestone pending release after Nick confirms.")
insert_milestone(pid, "Surge alerts + ranking", 80, "GBP", "Funded", 1)

# 4. Sahil — Amazon Shift Bot (45k INR)
pid = insert_project("sahil1705", "Amazon Shift Booking Bot", "Freelancer", "INR", 10, "InProgress", "2026-04-07", None, "Project ID 40350500. Multi-location deployed. Friday 2026-04-11 test day.")
insert_milestone(pid, "M1 — Core bot", 10000, "INR", "Paid", 1, date_paid="2026-04-07")
insert_milestone(pid, "M2 — Captcha + 2FA", 15000, "INR", "Paid", 2, date_paid="2026-04-07")
insert_milestone(pid, "M3 — Multi-location", 12000, "INR", "Paid", 3, date_paid="2026-04-07")
insert_milestone(pid, "M4 — First booking", 8000, "INR", "Pending", 4)

# 5. Maroan — TikTok Bot ($1300)
pid = insert_project("maroan10MB", "TikTok Mass Engagement Bot", "Freelancer", "USD", 10, "Awarded", "2026-04-08", None, "Project ID 40354991. Waiting for client infra.")
insert_milestone(pid, "M1 — Core framework", 400, "USD", "Pending", 1)
insert_milestone(pid, "M2 — Signing API integration", 450, "USD", "Pending", 2)
insert_milestone(pid, "M3 — Polish + support", 450, "USD", "Pending", 3)

# 6. Maaz — Amazon Shift Bot (quoted, never started)
pid = insert_project("maazm24", "Amazon Shift Bot", "Freelancer", "CAD", 10, "Quoted", None, None, "Original quote. Client went silent.")
insert_milestone(pid, "Full delivery", 610, "CAD", "Pending", 1)

# 7. Gautham — Claude Superagent (quoted)
pid = insert_project("gauthamm0", "Claude Superagent", "Freelancer", "INR", 10, "Quoted", None, None, "55k INR quote. Client asking questions.")
insert_milestone(pid, "Full delivery", 55000, "INR", "Pending", 1)

print("Seeding costs...")
# Recurring costs in original currency (auto-converted to NOK using exchange rates)
insert_cost("Claude Max x5", 125, "USD", "Software", 3, 2026, True)
insert_cost("Freelancer Plus", 9.99, "USD", "Software", 3, 2026, True)
# One-time costs
insert_cost("Highlight bid", 0.30, "USD", "Software", 3, 2026, False)

print("Seeding investments...")
insert_investment("English Exam", 5, "USD", 9.78, 3, 2026)
insert_investment("Python Exam", 5, "USD", 9.78, 3, 2026)

conn.commit()
conn.close()
print("Done! All data seeded.")
