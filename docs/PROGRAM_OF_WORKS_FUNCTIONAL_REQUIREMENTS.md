# Functional Requirements

Program of Works (POW) — Libraries Management

Date: September 23, 2026

## 1. Purpose and Scope

This document defines the functional requirements for the library-management component of the Program of Works (POW) system. Its scope is limited to Categories, Labor, Equipment, Items, Prices, and Signatories. Categories and Items integrate with the Procurement Information System (PIS); the other libraries are maintained within POW.

## 2. Library Access and Common Functions

- **FR-2.1:** The system shall provide separate POW libraries for Categories, Labor, Equipment, Items, Prices, and Signatories.
- **FR-2.2:** The system shall require an authenticated, active user to access the POW libraries.
- **FR-2.3:** The system shall allow users with `libraries.view` permission to view and search library records.
- **FR-2.4:** The system shall control the creation, update, and deletion of library records through the `libraries.create`, `libraries.update`, and `libraries.delete` permissions respectively.
- **FR-2.5:** The system shall display each library as a paginated list containing 15 records per page.
- **FR-2.6:** The system shall allow a user to search using the displayed fields of the selected library.
- **FR-2.7:** The system shall validate all required fields and display field-specific errors before saving invalid data.
- **FR-2.8:** The system shall display a confirmation message after a successful create, update, delete, or synchronization operation.
- **FR-2.9:** The system shall prevent deletion of a library record that is referenced by a DUPA, item, price, or other protected record.

## 3. Category Library and PIS Synchronization

- **FR-3.1:** The Category library shall list the Category ID, fund-center code, category description, and active status.
- **FR-3.2:** The system shall allow an authorized user to create, view, edit, search, activate or deactivate, and delete category records.
- **FR-3.3:** The Category ID shall be a unique positive integer, and the category description shall be required.
- **FR-3.4:** The system shall provide a “Sync categories” function that retrieves the complete category list from the Procurement Information System.
- **FR-3.5:** Category synchronization shall require both library-create and library-update permission.
- **FR-3.6:** The system shall retrieve PIS categories from the configured PIS category endpoint using a valid HTTP or HTTPS base URL.
- **FR-3.7:** The system shall validate each synchronized category for a distinct Category ID, description, optional fund-center code, and supplied active-status field before saving any category.
- **FR-3.8:** The system shall add categories that do not yet exist and update matching categories using the Category ID as the unique key.
- **FR-3.9:** When PIS omits a fund-center code, the system shall preserve the locally stored code; when PIS supplies a code, including a blank value, the system shall use the supplied value.
- **FR-3.10:** When PIS supplies a null active status, the system shall preserve an existing category's local status and use the default active status for a new category.
- **FR-3.11:** Category synchronization shall not delete local categories that are absent from the PIS response.
- **FR-3.12:** The system shall reject paginated, malformed, incomplete, unreachable, or unsuccessful PIS category responses without partially changing the Category library.
- **FR-3.13:** The system shall prevent deletion of a category currently assigned to an item.

## 4. Labor Library

- **FR-4.1:** The Labor library shall define the manpower resources available for Program of Works estimates.
- **FR-4.2:** Each labor record shall contain a manpower designation, a non-negative labor rate, and a labor type.
- **FR-4.3:** The labor type shall be either Contract or Admin.
- **FR-4.4:** The system shall allow an authorized user to create, view, search, edit, and delete labor records.
- **FR-4.5:** The system shall allow an authorized user to create a labor record directly from the DUPA editor and immediately return the created manpower record for selection.

## 5. Equipment Library

- **FR-5.1:** The Equipment library shall define the equipment resources available for Program of Works estimates.
- **FR-5.2:** Each equipment record shall contain an equipment description and a non-negative rental rate.
- **FR-5.3:** The system shall allow an authorized user to create, view, search, edit, and delete equipment records.
- **FR-5.4:** The system shall allow an authorized user to create an equipment record directly from the DUPA editor and immediately return the created equipment record for selection.

## 6. Item Library and PIS Synchronization

- **FR-6.1:** The Item library shall list the item code, category, description, unit, latest unit price, effective-from date, and effective-to date.
- **FR-6.2:** Each item shall have a unique item code and shall be assigned to an existing category.
- **FR-6.3:** Each item shall have a required description and unit of measurement.
- **FR-6.4:** The system shall allow an authorized user to create, view, search, edit, and delete item records.
- **FR-6.5:** The system shall provide a “Sync items” function that retrieves items and their prices from the Procurement Information System for one or more user-selected categories.
- **FR-6.6:** Item synchronization shall require both library-create and library-update permission.
- **FR-6.7:** The system shall allow the user to search the available categories, select displayed categories, clear the selection, and view the number of selected categories before synchronization.
- **FR-6.8:** The system shall require at least one existing category to be selected before requesting items from PIS.
- **FR-6.9:** The item synchronization request shall send the selected Category IDs to the configured PIS item endpoint.
- **FR-6.10:** The system shall accept only items belonging to the selected categories and shall validate item code, category, description, unit, price, and price-effectivity dates before saving any returned item.
- **FR-6.11:** The system shall add new items and update the category, description, and unit of existing items that have the same item code.
- **FR-6.12:** If a synchronized item has no unit, the system shall preserve the existing unit or assign `N/A` to a new item.
- **FR-6.13:** Every successful item synchronization shall append the returned price as a price-history record for the applicable item.
- **FR-6.14:** The system shall reject duplicate item codes, items outside the selected categories, invalid price ranges, paginated responses, connection failures, and unsuccessful PIS responses without partially updating items or prices.
- **FR-6.15:** The system shall report the number of items processed after synchronization, including when PIS returns an empty list.

## 7. Price Library

- **FR-7.1:** The Price library shall list the item code, price, effective-from date, and optional effective-to date for each price-history record.
- **FR-7.2:** Each price-history record shall reference an existing item code.
- **FR-7.3:** The price shall be non-negative and shall contain no more than two decimal places.
- **FR-7.4:** The effective-from date shall be required, and the effective-to date shall not be earlier than the effective-from date.
- **FR-7.5:** The system shall allow an authorized user to create, view, search, edit, and delete price-history records.
- **FR-7.6:** The Item library shall display the most recently effective price information associated with each item.
- **FR-7.7:** When a DUPA uses an item, the system shall apply the currently effective price or, when no price is currently effective, the latest available price.
- **FR-7.8:** The system shall prevent the selection of an item for a DUPA when the item has no price history.

## 8. Signatory Library

- **FR-8.1:** The Signatory library shall list the CATS number, name, position, linked system user, assigned signatory roles, and active status.
- **FR-8.2:** The system shall allow an authorized user to create, view, search, and edit signatory records.
- **FR-8.3:** Each signatory shall have a unique CATS number, name, and position.
- **FR-8.4:** A signatory may be linked to one system user, and a system user shall not be linked to more than one signatory.
- **FR-8.5:** The system shall support the roles Checked by, Recommending approval, Included in AIP, Recommending approval (PAO), and Approved by.
- **FR-8.6:** Only one current active signatory shall hold each signatory role at a time.
- **FR-8.7:** Reassigning a role from one signatory to another shall require library-update permission and shall transfer the current role assignment.
- **FR-8.8:** Deactivating a signatory shall remove all of that signatory's current role assignments.
- **FR-8.9:** The system shall retain signatory records for Program of Works project history and shall require users to deactivate rather than delete a signatory.
- **FR-8.10:** The system shall use the current active role assignments as the default signatories for newly created Program of Works projects.
- **FR-8.11:** A user creating a Program of Works project shall be linked to an active signatory so that the user can be recorded as the project preparer.

## 9. Synchronization Integrity and Feedback

- **FR-9.1:** Category and Item synchronizations shall be atomic so that an invalid row or failed operation does not leave partial library changes.
- **FR-9.2:** The system shall trim leading and trailing whitespace from synchronized descriptions, item codes, units, and price dates where applicable.
- **FR-9.3:** The system shall display a clear error when the PIS URL is missing or invalid, PIS cannot be reached, PIS returns an unsuccessful response, or returned data is invalid.
- **FR-9.4:** The system shall display the number of successfully synchronized categories or items after each completed synchronization.
- **FR-9.5:** The system shall not silently accept only the first page of a paginated PIS response; PIS shall return the complete requested list.
