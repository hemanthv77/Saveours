# Saveours

## Connecting Communities Through Home-Cooked Food

---

## Executive Summary

**Saveours** is a hyperlocal food marketplace that connects home cooks with hungry neighbors within trusted community networks. By creating a platform where anyone can share their culinary creations with their local community, Saveours is revolutionizing how people discover, order, and enjoy authentic home-cooked meals while helping reduce food waste and empowering home-based food entrepreneurs.

### The Vision

Imagine a world where the aroma of freshly made biryani from your neighbor's kitchen becomes your dinner, where grandma's legendary recipes are shared not just within families but with an entire community, and where every home cook has the opportunity to earn from their passion. That's Saveours.

### Key Metrics at a Glance

| Metric | Description |
|--------|-------------|
| **Target Market** | Urban neighborhoods, residential societies, apartment complexes |
| **User Types** | Food Creators (Sellers) & Food Lovers (Buyers) |
| **Revenue Model** | 2% platform fee on every transaction |
| **Geographic Focus** | India (initial launch) |

---

## The Problem We're Solving

### For Food Lovers (Buyers)

1. **Limited Variety**: Restaurant food becomes repetitive; people crave authentic, home-style cooking
2. **Trust Issues**: Ordering from unknown sources feels risky—who's cooking your food?
3. **Expensive Delivery**: High delivery fees and minimum order requirements make casual ordering expensive
4. **Missing Connection**: Modern food delivery is transactional; there's no relationship with who makes your food

### For Home Cooks (Sellers)

1. **Wasted Potential**: Talented home cooks have no easy way to monetize their skills
2. **Food Waste**: Often, home cooks make extra food that goes to waste
3. **Limited Reach**: No platform connects them specifically with their immediate neighborhood
4. **Complex Setup**: Starting a food business traditionally requires licenses, infrastructure, and significant investment

### For Communities

1. **Disconnection**: Urban living has made neighbors strangers
2. **Sustainability**: Food waste is a growing environmental concern
3. **Economic Opportunity**: Local economic circulation is limited

---

## Our Solution: The Saveours Platform

### Core Concept: Food Communities

Saveours introduces the concept of **Food Communities**—trusted, hyperlocal groups where members can share and purchase home-cooked food. Think of it as a neighborhood food network where:

- **Trust is Built-In**: Every member is verified within their community
- **Proximity is Key**: Sellers and buyers are often just floors or streets apart
- **Quality is Social**: Ratings and reviews come from people you might actually know

### How It Works

```
┌─────────────────────────────────────────────────────────────────┐
│                    THE SAVEOURS ECOSYSTEM                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   🏠 COMMUNITIES          →    🍳 FOOD POSTS    →    🛒 ORDERS  │
│                                                                  │
│   • Create or Join        →    • Post Today's    →    • Browse   │
│   • Public or Private     →      Menu            →    • Add to   │
│   • Verified Members      →    • Set Portions    →      Cart     │
│   • Local Radius          →    • Upload Photos   →    • Checkout │
│                                                                  │
│                              ↓                          ↓        │
│                                                                  │
│                    💬 REAL-TIME COMMUNICATION                    │
│                    📱 PUSH NOTIFICATIONS                         │
│                    📍 PICKUP COORDINATION                        │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Platform Features

### 1. Community Management

#### Creating Communities
Any user can create a food community. Communities can be:

| Type | Description | Use Case |
|------|-------------|----------|
| **Public** | Anyone can join instantly | Apartment complexes, large societies |
| **Private** | Requires admin approval to join | Exclusive groups, verified members only |

#### Community Features
- **Custom Cover Images**: Brand your community with attractive visuals
- **Screening Questions**: For private communities, admins can ask questions before approving members
- **Radius Control**: Set the geographic boundary for your community (e.g., 5km radius)
- **Capacity Limits**: Control community size for quality management
- **Member Management**: Admins can add, remove, or promote members

#### Join Request Flow (Private Communities)
1. User discovers community
2. Submits join request with answers to screening questions
3. Admin reviews request and member profile
4. Admin approves or declines
5. Approved user receives notification and gains access

---

### 2. Food Posting (For Sellers)

#### "Today's Menu" Feature
The heart of Saveours is the **Today's Menu** posting feature, where food creators share what they're cooking:

**Creating a Food Post:**
1. **Add Dishes**: Up to 10 different dishes per post
2. **Upload Photos**: Beautiful food photography (up to 5 photos per dish)
3. **Set Pricing**: Per-portion pricing in INR (₹)
4. **Specify Portions**: How many portions are available
5. **Publish**: Post goes live to community members instantly

**Example Post:**
```
┌────────────────────────────────────────┐
│  🍲 Priya's Kitchen                    │
│  Posted 2 hours ago                    │
├────────────────────────────────────────┤
│  📸 [Photo of Biryani]                 │
│                                        │
│  🍛 Hyderabadi Dum Biryani             │
│     ₹150/portion • 12 portions left    │
│                                        │
│  🥗 Raita                              │
│     ₹30/portion • 20 portions left     │
│                                        │
│  [+ Add to Cart]    [View Kitchen]     │
└────────────────────────────────────────┘
```

#### Seller Benefits
- **Zero Setup Cost**: Start selling immediately with no upfront investment
- **Flexible Scheduling**: Cook when you want, post when you're ready
- **Portion Control**: Never overcommit—set exactly how much you can prepare
- **Real-Time Updates**: See orders come in as customers place them
- **Direct Communication**: Chat with buyers for any clarifications

---

### 3. Ordering Experience (For Buyers)

#### Discovering Food
Buyers browse the **Community Feed** to discover what's cooking:
- **Today's Posts**: See fresh food posts from community members
- **Kitchen Profiles**: View a seller's history and ratings
- **Portion Availability**: Real-time stock updates

#### The Cart System
Saveours features a sophisticated cart system:
- **Single Seller Per Cart**: Ensures order simplicity
- **Real-Time Stock Sync**: Portions are reserved as you add to cart
- **Cart Expiry**: 15-minute reservation window to keep things fair
- **Multi-Item Orders**: Order multiple dishes from the same seller

#### Checkout Flow
1. **Review Cart**: See all items and totals
2. **Add Contact Info**: Name and phone for pickup coordination
3. **Special Instructions**: Dietary needs, spice levels, etc.
4. **Payment Selection**: Cash on pickup or digital payment
5. **Place Order**: Confirmation and tracking begins

#### Transparent Pricing
```
Order Summary
─────────────────────────────
Biryani (2 portions)    ₹300
Raita (2 portions)       ₹60
─────────────────────────────
Subtotal                ₹360
Platform Fee (2%)         ₹7
─────────────────────────────
Total                   ₹367
```

---

### 4. Order Management

#### Order Status Flow

```
┌──────────┐    ┌───────────┐    ┌───────────┐    ┌─────────┐    ┌───────────┐
│  PLACED  │ →  │ CONFIRMED │ →  │ PREPARING │ →  │  READY  │ →  │ COMPLETED │
└──────────┘    └───────────┘    └───────────┘    └─────────┘    └───────────┘
     │               │                │               │               │
     │               │                │               │               │
   Buyer          Seller           Seller          Seller          Seller
   places         accepts          starts          marks           marks
   order          order           cooking        for pickup      as picked up
```

#### For Buyers: Order Tracking
- **Real-Time Status Updates**: Know exactly where your order stands
- **Push Notifications**: Get notified at every status change
- **Order Details View**: Complete breakdown of your order
- **Pickup Directions**: Get directions to the seller's location
- **Message Seller**: Direct chat for any questions
- **Order Cancellation**: Cancel pending orders if needed

#### For Sellers: Order Management Dashboard
- **Active Orders Tab**: All orders needing attention
- **Completed Orders Tab**: Order history
- **Status Updates**: One-tap status changes
- **Buyer Information**: Contact details for coordination
- **Cancel with Reason**: Decline orders with explanation
- **Message Buyer**: Direct communication channel

---

### 5. Real-Time Communication

#### In-App Chat
Every order creates a direct communication channel between buyer and seller:
- **Order-Linked Chats**: Chat is automatically created with order reference
- **Message History**: Full conversation history preserved
- **Read Receipts**: Know when messages are seen
- **Push Notifications**: Never miss a message

#### Push Notifications
Saveours keeps everyone informed with intelligent notifications:

| Event | Buyer Notification | Seller Notification |
|-------|-------------------|---------------------|
| Order Placed | Confirmation | "New Order! 🎉" |
| Order Confirmed | "Order Confirmed! ✅" | — |
| Preparing | "Order Being Prepared 👨‍🍳" | — |
| Ready | "Order Ready for Pickup! 🎉" | — |
| New Message | Sender name + preview | Sender name + preview |
| Join Approved | "You've been accepted!" | — |

---

### 6. Profile & Account Management

#### User Profile Features
- **Profile Photo**: Build trust with a face to the name
- **Personal Details**: Name, contact information
- **Address Management**: For pickup coordination
- **Community Memberships**: See all your communities
- **Order History**: Both placed and received orders

#### Dual Role Support
Every Saveours user can be both a buyer AND a seller:
- **Placed Orders**: Orders you've made as a buyer
- **Received Orders**: Orders you've received as a seller
- **Seamless Switching**: No separate accounts needed

---

## User Flows

### Flow 1: New User Journey

```
Download App → Sign Up → Browse Communities → Join Community → 
Browse Food → Add to Cart → Checkout → Track Order → Pickup → Rate
```

### Flow 2: Becoming a Seller

```
Join Community → Navigate to Community Feed → Tap "What's Cooking?" → 
Create Menu → Add Dishes with Photos → Set Prices & Portions → 
Publish → Receive Orders → Manage Orders → Build Reputation
```

### Flow 3: Creating a Community

```
Open App → Profile Menu → Create Community → Set Name & Description → 
Upload Cover Image → Choose Public/Private → Set Radius → 
Add Screening Questions (if private) → Publish → Invite Members → 
Manage Join Requests → Grow Community
```

### Flow 4: Complete Order Lifecycle

```
BUYER                           SELLER
  │                               │
  ├── Browses Community Feed      │
  ├── Adds items to cart          │
  ├── Places order ───────────────┼── Receives notification
  │                               ├── Reviews order
  │   Gets "Confirmed" alert ←────┼── Confirms order
  │   Gets "Preparing" alert ←────┼── Starts cooking
  │   Gets "Ready" alert ←────────┼── Marks ready
  ├── Goes to pickup location     │
  ├── Collects order              │
  │                               ├── Marks completed
  └── Order complete              └── Order complete
```

---

## Value Proposition

### For Buyers

| Benefit | Description |
|---------|-------------|
| **🏠 Hyperlocal** | Food from your own neighborhood—fresh and close |
| **💰 Affordable** | No delivery fees, lower prices than restaurants |
| **🤝 Trusted** | Order from verified community members |
| **🍲 Authentic** | Real home cooking, not commercial production |
| **📱 Convenient** | Easy ordering, real-time tracking, direct chat |

### For Sellers

| Benefit | Description |
|---------|-------------|
| **💵 Extra Income** | Monetize your cooking skills |
| **🕐 Flexibility** | Cook when you want, no fixed commitments |
| **📊 Control** | Set your own prices and portions |
| **🏪 Zero Investment** | No need for shop, equipment, or licenses |
| **📈 Growth** | Build a local customer base and reputation |

### For Communities

| Benefit | Description |
|---------|-------------|
| **🌱 Sustainability** | Reduce food waste through portion sharing |
| **🤝 Connection** | Build stronger neighborhood bonds |
| **💪 Empowerment** | Enable local economic activity |
| **🔒 Safety** | Trusted, verified local network |

---

## Business Model

### Revenue Streams

1. **Platform Fee**: 2% fee on every transaction
   - Example: ₹500 order = ₹10 platform fee
   - Fair and sustainable for all parties

2. **Future Opportunities**:
   - Premium seller profiles
   - Featured listings
   - Community promotion
   - Delivery partnership integration

### Unit Economics Example

```
Average Order Value:        ₹350
Platform Fee (2%):          ₹7
─────────────────────────────────
Monthly Active Sellers:     1,000
Avg Orders per Seller:      30/month
─────────────────────────────────
Monthly Transactions:       30,000
Monthly Revenue:            ₹210,000
```

---

## Market Opportunity

### Target Demographics

**Primary Users:**
- Urban professionals (25-45 years)
- Working couples with limited cooking time
- Food enthusiasts seeking authentic home cooking
- Home cooks looking for extra income

**Primary Locations:**
- Apartment complexes (100+ units)
- Residential societies
- Gated communities
- Urban neighborhoods

### Market Size (India)

| Segment | Size |
|---------|------|
| Online Food Delivery Market | $8.5 Billion (2024) |
| Home Food Delivery (emerging) | Growing at 25% CAGR |
| Potential Users (Urban India) | 200+ Million |

### Competitive Advantage

Unlike traditional food delivery platforms:

1. **Community-First**: Trust through local networks
2. **No Restaurant Dependency**: Democratized food selling
3. **Lower Costs**: No delivery fleet, minimal overhead
4. **Unique Supply**: Home cooking not available elsewhere
5. **Sustainability Focus**: Reducing food waste

---

## Technology Stack

### Mobile Application
- **Framework**: React Native (iOS & Android from single codebase)
- **State Management**: Redux Toolkit
- **Real-Time Updates**: Firebase Firestore listeners

### Backend Services
- **Database**: Firebase Firestore (NoSQL, real-time sync)
- **Authentication**: Firebase Authentication
- **Storage**: Firebase Cloud Storage (images)
- **Notifications**: Firebase Cloud Messaging (FCM)

### Key Technical Features
- Real-time inventory management
- Push notification system
- In-app messaging
- Offline-capable cart
- Location-based services

---

## Roadmap

### Phase 1: Foundation (Current)
✅ Community creation and management
✅ Food posting with photos
✅ Cart and checkout system
✅ Order management for sellers
✅ Order tracking for buyers
✅ In-app messaging
✅ Push notifications
✅ User profiles

### Phase 2: Enhancement (Next 6 months)
- Rating and review system
- Seller verification badges
- Payment gateway integration
- Scheduled/recurring orders
- Favorite sellers and dishes
- Search and discovery improvements

### Phase 3: Scale (6-12 months)
- Delivery partner integration
- Multi-city expansion
- Community analytics for admins
- Seller analytics dashboard
- Promotional features
- Subscription meal plans

### Phase 4: Ecosystem (12+ months)
- Recipe sharing features
- Cooking classes/workshops
- Corporate catering
- Event catering
- White-label for housing societies

---

## Traction & Validation

### Early Indicators
- Platform built and functional
- Core features complete and tested
- Ready for pilot community launch

### Validation Strategy
1. **Pilot Program**: Launch in 3-5 apartment complexes
2. **User Feedback**: Iterate based on real usage
3. **Community Growth**: Organic expansion through word-of-mouth
4. **Success Metrics**: Track order volume, repeat purchases, seller retention

---

## Investment Opportunity

### Use of Funds

| Category | Allocation | Purpose |
|----------|------------|---------|
| Product Development | 40% | Feature enhancement, scalability |
| Marketing & Growth | 30% | User acquisition, community building |
| Operations | 20% | Team, infrastructure, support |
| Reserve | 10% | Contingency and opportunities |

### Key Milestones

| Timeline | Milestone |
|----------|-----------|
| Month 3 | 50 active communities |
| Month 6 | 500 active sellers |
| Month 9 | 10,000 monthly orders |
| Month 12 | Expansion to 3 cities |

---

## Team

*[To be filled with founding team details]*

---

## Contact

*[To be filled with contact information]*

---

## Appendix

### A. Feature Comparison

| Feature | Saveours | Swiggy/Zomato | WhatsApp Groups |
|---------|----------|---------------|-----------------|
| Home Cooking Focus | ✅ | ❌ | ✅ |
| Verified Communities | ✅ | ❌ | ❌ |
| Real-Time Tracking | ✅ | ✅ | ❌ |
| In-App Ordering | ✅ | ✅ | ❌ |
| Portion Management | ✅ | ❌ | ❌ |
| Low Platform Fee | ✅ (2%) | ❌ (15-30%) | ✅ (0%) |
| Seller Tools | ✅ | ✅ | ❌ |

### B. User Testimonials

*[To be added after launch]*

### C. Press & Media

*[To be added after launch]*

---

*"Every meal has a story. Saveours brings that story from your neighbor's kitchen to your table."*

---

© 2026 Saveours. All Rights Reserved.