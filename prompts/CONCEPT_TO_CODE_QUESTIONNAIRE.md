# Concept-to-Code Questionnaire

## 1) User Story and Problem
- User/Actor: Create a program that can be used to find any of the best prices on the internet based upon and item searched - the need is to search for primarily local foods and goods - shopping for any clothing and accessory as well
- Goal: the user is to search for a particular item and the service will check any known local business within a range configurable to find the best deals on the items they need - the user should then be able to purchase the product (whatever this looks like)
- Pain/Problem: it is combersome to look for items of all kinds of foods and clothes and accessorys on the internet. - one has to navigate to many sites in order to find the items they need. - using coupons is great and all but a system that can read ads and then just say its the best deal and pull the ad off any online page to pass through to the user or whatever and howver the discount price can be achieved - multi items from multiple stores should be able to be purchased - one should also have the ability to have said purchased items delivered through any relevant service -- broker that to the delivery services APIs for drivers / orders / deliveries for items of such order type

## 2) Outcome and Success Criteria
- Done State: The system should be able to allow a user to purchase or go and pick up items from various locations for the best active price for said items across all known local businesses - this should use some publicly available map system - should use a way to analyze across many sites for to determine a conclusive best price per item - system should enhance the velocity to with which people can make decisions about buying items of such requested type for the best price thus increasing sales for said business
- Success Signals: the system should be broken down in to the necessary about of phases that are elemental for the structure of a system that can do this type of cross site and systems analysis on shopping items across multiple vendors.

## 3) Scope Boundaries
- In Scope: this should be used as a core document of length X to ensure all necessary items are equally broken down in to necessary parts for with which further turns with prompting to hone in on final details
- Out of Scope: You may only work within the space of a new docker container

## 4) Workflow (Happy Path)
- Steps: login search for item view items across different store create cart of items across different store purchase items across different store - pick up item in person - deliver via necessary online to home delivery systems based upon item weight, order size, function
- Boundaries: program begins upon user search for any everyday item as previously mentioned

## 5) Failure Paths and Edge Cases
- Failure Modes: if for which an item can not be found analysis or greping for words out of the item or similar named products based upon listing should be shown at the bottom of the list of items as (similar items)
- Failure Behavior: if for a reason that input search item is nonsensical then do not submit query. items for search must be in common user language dictionary and similar with allowed for misspellings

## 6) Data and Interfaces
- Inputs: necessary web page items are required to properly separate this app in to sections
- Outputs: item images, price, store name, mileage to location, store reviews averaged across multiple online sources
- Contracts/Interfaces: items on page are immutable and are only to be viewable by the user so as to protect the user from malformed or malicious input

## 7) Tech Choices (Frameworks, Patterns, Constraints)
- Runtime: web serve front in. fast and light - database for searches and handling query and view data
- Patterns: search across multiple sites at the same time or in parallel.
- Constraints: Docker

## 8) Security and Access Rules
- Auth Requirements: should be protected by an auth page
- Sensitive Data: credit card or purchase data can be saved to make for a safe and secure shopping experience - whatever the best way to do this is
- Least Privilege: non-root user server and system - no element of this system shall run as root - all communication with external services should be encrypted - dns can be send on udp 53 - input sensitization, CSRF, and XSS protections

## 9) Test Plan
- Unit Tests:
- Integration Tests:
- Pre-Merge Validation: this is a detailed planning prompt run

## 10) Release and Observability
- Rollout: this is a plan document and should be a canary where we can expand on any piece of this and then turn it in to code
- Telemetry: create necessary logging to work through API or integration failures
- Rollback: this is a plan document
