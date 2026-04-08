#!/usr/bin/env python3
"""Seed FreelanceLedger database with existing spreadsheet data + milestone details from memory."""
import json
import urllib.request

API = "http://localhost:5145/api"

def post(path, data):
    req = urllib.request.Request(f"{API}{path}", json.dumps(data).encode(), {"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        print(f"POST {path} failed ({e.code}): {body}")
        raise

def put(path, data):
    req = urllib.request.Request(f"{API}{path}", json.dumps(data).encode(), {"Content-Type": "application/json"}, method="PUT")
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read())

# --- Exchange Rates ---
rates = [
    # March 2026
    {"currency": "GBP", "month": 3, "year": 2026, "rate": 12.93},
    {"currency": "USD", "month": 3, "year": 2026, "rate": 9.78},
    {"currency": "EUR", "month": 3, "year": 2026, "rate": 11.22},
    {"currency": "CAD", "month": 3, "year": 2026, "rate": 7.01},
    {"currency": "INR", "month": 3, "year": 2026, "rate": 0.10},
    # April 2026
    {"currency": "GBP", "month": 4, "year": 2026, "rate": 12.92},
    {"currency": "USD", "month": 4, "year": 2026, "rate": 9.77},
    {"currency": "EUR", "month": 4, "year": 2026, "rate": 11.22},
    {"currency": "CAD", "month": 4, "year": 2026, "rate": 7.01},
    {"currency": "INR", "month": 4, "year": 2026, "rate": 0.1045},
]
print("Seeding exchange rates...")
for r in rates:
    put("/exchange-rates", r)

# --- Projects + Milestones + Tips ---
print("Seeding projects...")

# 1. Nick — Claude Code Investment Bot (original, £180)
p = post("/projects", {
    "clientName": "nick111nick111",
    "projectName": "Claude Code Investment Bot Development",
    "platform": "Freelancer",
    "currency": "GBP",
    "feePercentage": 10,
    "status": "Paid",
    "dateAwarded": "2026-03-31",
    "dateCompleted": "2026-03-31",
    "notes": "First freelance delivery. Project ID 40332834."
})
pid = p["id"]
post(f"/projects/{pid}/milestones", {"name": "Milestone 1", "amount": 90, "currency": "GBP", "status": "Paid", "datePaid": "2026-03-31", "sortOrder": 1})
post(f"/projects/{pid}/milestones", {"name": "Milestone 2", "amount": 90, "currency": "GBP", "status": "Paid", "datePaid": "2026-03-31", "sortOrder": 2})
post(f"/projects/{pid}/tips", {"amount": 9, "currency": "GBP", "date": "2026-03-31", "notes": "Tip from Nick"})

# 2. Nick — TaoBot Upgrade / Fallback RPC (£87.55)
p = post("/projects", {
    "clientName": "nick111nick111",
    "projectName": "TaoBot Upgrade — Fallback RPC",
    "platform": "Freelancer",
    "currency": "GBP",
    "feePercentage": 10,
    "status": "Paid",
    "dateAwarded": "2026-04-03",
    "dateCompleted": "2026-04-04",
    "notes": "Project ID 40346281. Replaced 7x queries with 1x bulk, cycle 200s->7s."
})
pid = p["id"]
post(f"/projects/{pid}/milestones", {"name": "Fallback RPC upgrade", "amount": 87.55, "currency": "GBP", "status": "Paid", "datePaid": "2026-04-04", "sortOrder": 1})
post(f"/projects/{pid}/tips", {"amount": 8.50, "currency": "GBP", "date": "2026-04-04", "notes": "Tip from Nick"})

# 3. Nick — Surge Alerts + Subnet Ranking (£80)
p = post("/projects", {
    "clientName": "nick111nick111",
    "projectName": "Surge Alerts + Subnet Ranking",
    "platform": "Freelancer",
    "currency": "GBP",
    "feePercentage": 10,
    "status": "InProgress",
    "dateAwarded": "2026-04-07",
    "notes": "£80 milestone created by Nick, pending release after confirmation."
})
pid = p["id"]
post(f"/projects/{pid}/milestones", {"name": "Surge alerts + ranking", "amount": 80, "currency": "GBP", "status": "Funded", "sortOrder": 1})

# 4. Sahil — Amazon Shift Bot (45k INR)
p = post("/projects", {
    "clientName": "sahil1705",
    "projectName": "Amazon Shift Booking Bot",
    "platform": "Freelancer",
    "currency": "INR",
    "feePercentage": 10,
    "status": "InProgress",
    "dateAwarded": "2026-04-07",
    "notes": "Project ID 40350500. Multi-location deployed. Friday 2026-04-11 test day."
})
pid = p["id"]
post(f"/projects/{pid}/milestones", {"name": "M1 — Core bot", "amount": 10000, "currency": "INR", "status": "Paid", "datePaid": "2026-04-07", "sortOrder": 1})
post(f"/projects/{pid}/milestones", {"name": "M2 — Captcha + 2FA", "amount": 15000, "currency": "INR", "status": "Paid", "datePaid": "2026-04-07", "sortOrder": 2})
post(f"/projects/{pid}/milestones", {"name": "M3 — Multi-location", "amount": 12000, "currency": "INR", "status": "Paid", "datePaid": "2026-04-07", "sortOrder": 3})
post(f"/projects/{pid}/milestones", {"name": "M4 — First booking", "amount": 8000, "currency": "INR", "status": "Pending", "sortOrder": 4})

# 5. Maroan — TikTok Bot ($1300)
p = post("/projects", {
    "clientName": "maroan10MB",
    "projectName": "TikTok Mass Engagement Bot",
    "platform": "Freelancer",
    "currency": "USD",
    "feePercentage": 10,
    "status": "Awarded",
    "dateAwarded": "2026-04-08",
    "notes": "Project ID 40354991. Waiting for client infra (TikAPI, VPS, proxies)."
})
pid = p["id"]
post(f"/projects/{pid}/milestones", {"name": "M1 — Core framework", "amount": 400, "currency": "USD", "status": "Pending", "sortOrder": 1})
post(f"/projects/{pid}/milestones", {"name": "M2 — Signing API integration", "amount": 450, "currency": "USD", "status": "Pending", "sortOrder": 2})
post(f"/projects/{pid}/milestones", {"name": "M3 — Polish + support", "amount": 450, "currency": "USD", "status": "Pending", "sortOrder": 3})

# 6. Maaz — Amazon Shift Bot (quoted, never started)
p = post("/projects", {
    "clientName": "maazm24",
    "projectName": "Amazon Shift Bot",
    "platform": "Freelancer",
    "currency": "CAD",
    "feePercentage": 10,
    "status": "Quoted",
    "notes": "Original Amazon bot quote. Client went silent. Sahil took it instead."
})
pid = p["id"]
post(f"/projects/{pid}/milestones", {"name": "Full delivery", "amount": 610, "currency": "CAD", "status": "Pending", "sortOrder": 1})

# 7. Gautham — Claude Superagent (quoted)
p = post("/projects", {
    "clientName": "gauthamm0",
    "projectName": "Claude Superagent",
    "platform": "Freelancer",
    "currency": "INR",
    "feePercentage": 10,
    "status": "Quoted",
    "notes": "55k INR quote. Client asking questions, hasn't committed."
})
pid = p["id"]
post(f"/projects/{pid}/milestones", {"name": "Full delivery", "amount": 55000, "currency": "INR", "status": "Pending", "sortOrder": 1})

# --- Costs ---
print("Seeding costs...")

# March
post("/costs", {"description": "Claude Max x5", "amount": 1222.50, "category": "Software", "month": 3, "year": 2026, "recurring": True, "notes": "125 USD * 9.78"})
post("/costs", {"description": "Freelancer Plus", "amount": 97.70, "category": "Software", "month": 3, "year": 2026, "recurring": True, "notes": "9.99 USD * 9.78"})
post("/costs", {"description": "Highlight bid", "amount": 2.93, "category": "Software", "month": 3, "year": 2026, "recurring": False})

# April
post("/costs", {"description": "Claude Max x5", "amount": 1221.25, "category": "Software", "month": 4, "year": 2026, "recurring": True, "notes": "125 USD * 9.77"})
post("/costs", {"description": "Freelancer Plus", "amount": 97.60, "category": "Software", "month": 4, "year": 2026, "recurring": True, "notes": "9.99 USD * 9.77"})

# --- Investments ---
print("Seeding investments...")
post("/investments", {"description": "English Exam", "amount": 5, "currency": "USD", "nokRate": 9.78, "month": 3, "year": 2026})
post("/investments", {"description": "Python Exam", "amount": 5, "currency": "USD", "nokRate": 9.78, "month": 3, "year": 2026})

print("Done! All data seeded.")
