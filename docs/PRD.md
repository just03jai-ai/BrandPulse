# BrandPulse — Product Requirements Document

## 1. Product Overview

**Product Name:** BrandPulse  
**Type:** B2B SaaS — Employee Advocacy Intelligence Platform  
**Tagline:** Measure, gamify, and amplify employee-driven brand growth.

BrandPulse gives companies real-time visibility into how employees engage with official brand content on LinkedIn (and later Instagram). It converts passive employees into active brand advocates by gamifying participation and rewarding top contributors.

---

## 2. Problem Statement

Companies invest heavily in content marketing but have no way to:
- Know which employees are sharing, liking, or commenting on company posts
- Measure the compounding reach employees generate
- Motivate employees to participate consistently
- Identify top advocates for recognition or reward

HR and Marketing teams resort to manual tracking in spreadsheets, which is error-prone, delayed, and unscalable.

---

## 3. Target Users

| Persona | Role | Primary Goal |
|---|---|---|
| **Admin / Marketing Manager** | Sets up campaigns, manages employees, views analytics | Maximize reach and participation rates |
| **HR Manager** | Manages rewards, badges, employee onboarding | Drive engagement and culture |
| **Employee / Advocate** | Participates in campaigns, checks rankings | Earn points, badges, and rewards |
| **Executive / C-Suite** | Views high-level dashboard | Understand ROI of advocacy program |

---

## 4. Goals & Success Metrics

### Business Goals
- Increase employee participation in brand campaigns by 3x vs. baseline
- Reduce time marketing teams spend tracking advocacy from hours → minutes
- Provide measurable ROI on employee advocacy programs

### Success Metrics (KPIs)
| Metric | Target (6 months post-launch) |
|---|---|
| Monthly Active Advocates | ≥ 60% of enrolled employees |
| Avg. Engagements per Campaign | 2x pre-BrandPulse baseline |
| Admin Time Saved | ≥ 5 hrs/week per admin |
| Campaign Participation Rate | ≥ 40% of employees per campaign |

---

## 5. Core Features (MVP)

### 5.1 Employee Leaderboard
- Real-time ranking of employees by advocacy score
- Score calculation:
  - Like = 1 point
  - Comment = 1.5 points
  - Share = 2 points
  - Reshare = 3 points
- Filterable by: department, campaign, time period (weekly / monthly / all-time)
- Highlights top 3 with visual trophy treatment

### 5.2 Campaign Tracking
- Admin creates a campaign tied to specific LinkedIn post URLs
- System polls LinkedIn for engagement events (likes, comments, shares)
- Maps engagements back to employee LinkedIn profiles
- Shows per-campaign participation rate and engagement totals
- Campaign states: Draft → Active → Completed → Archived

### 5.3 Analytics Dashboard
- Participation rate (employees engaged / total enrolled)
- Total engagement generated (sum of all interactions)
- Estimated reach (shares × average connections)
- Top 5 advocates (by score)
- Department performance heatmap
- Trend charts (weekly/monthly)

### 5.4 Gamification
- Monthly score resets with snapshot archival
- Badge system (see §6 for badge catalog)
- Achievement levels: Newcomer → Rising Star → Champion → Legend → Ambassador
- Rewards catalog: admins create rewards, employees redeem with points

### 5.5 Content Hub
- Employees browse a feed of company-approved posts
- One-click copy of pre-approved captions
- Direct "Share to LinkedIn" deep-link button
- Post tagging by topic/campaign

### 5.6 Admin Dashboard
- Campaign CRUD (create, edit, activate, archive)
- Employee management (invite, deactivate, assign departments)
- Full analytics export to CSV
- Reward and badge management
- Organization settings (branding, scoring weights)

### 5.7 AI Layer
- Caption generator: input topic/tone → output 3 caption variants using Claude API
- Hashtag suggester: analyze post content → suggest 5–10 trending/relevant hashtags
- Best time to post: heuristic recommendations based on industry and day of week

---

## 6. Gamification Specification

### Achievement Levels
| Level | Points Required | Badge Color |
|---|---|---|
| Newcomer | 0–49 | Gray |
| Rising Star | 50–199 | Bronze |
| Champion | 200–499 | Silver |
| Legend | 500–999 | Gold |
| Ambassador | 1000+ | Platinum |

### Badge Catalog (MVP)
| Badge | Trigger |
|---|---|
| First Share | Share a company post for the first time |
| Campaign Starter | Participate in your first campaign |
| 3-Peat | Participate in 3 consecutive campaigns |
| Department MVP | Rank #1 in your department for a month |
| Comment King/Queen | 10+ comments in a single month |
| Power Sharer | 20+ shares in a single month |
| Early Bird | Engage with a post within 1 hour of publishing |
| All-Star | Earn all 5 engagement types in a single campaign |

---

## 7. Non-MVP Features (Post-Launch)

- Instagram integration
- Slack / Teams bot notifications ("You've been ranked #3 this week!")
- Peer recognition ("Shoutout" feature)
- Advanced AI: personalized content recommendations per employee
- Manager reporting view
- SSO / SAML integration
- White-labeling for agencies

---

## 8. User Stories

### Employee
- As an employee, I want to see my current rank and score so I can know where I stand.
- As an employee, I want to browse approved company posts and copy captions easily.
- As an employee, I want to earn badges for milestones so I feel recognized.
- As an employee, I want to redeem points for rewards so participation has tangible value.

### Admin
- As an admin, I want to create a campaign by pasting a LinkedIn post URL so I can track engagement automatically.
- As an admin, I want to see which departments are underperforming so I can take action.
- As an admin, I want to export reports so I can share data with leadership.
- As an admin, I want to create rewards and set point costs so I can incentivize advocates.

---

## 9. Constraints & Assumptions

- **LinkedIn API:** LinkedIn's public APIs have limited engagement data access. MVP will use a combination of LinkedIn's API and manual/webhook-based tracking. Employees must connect their LinkedIn accounts via OAuth.
- **Multi-tenancy:** Each organization is fully isolated. No cross-org data sharing.
- **Data retention:** Engagement data retained for 24 months by default.
- **Compliance:** GDPR-aware; employees can request data deletion.
- **Scale assumption:** MVP targets organizations with 50–2,000 employees.
