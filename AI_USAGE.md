# AI Usage Log & Code Correction History

This document details how AI was utilized during the development of the Shared Expense Tracker and documents concrete cases of debugging and error correction.

---

## 🤖 AI Development Collaboration

- **Collaborator**: Google DeepMind's **Antigravity** Agentic Coding Assistant.
- **Roles Assumed**:
  - *Tech Lead*: Assisted with system architecture, setting files modularity, and deployment blueprints.
  - *Database Architect*: Configured relational constraints, index optimizations, and SQL transactions.
  - *Frontend Engineer*: Initialized React/Vite, Tailwind v4 styling tokens, and Axios request configurations.

---

## 🛠️ Concrete Cases of AI Errors & Corrections

During development, five instances occurred where the AI agent generated code with defects or omissions. Here is how they were detected and resolved:

### Case 1: Psycopg v2 Windows Compilation Failure (Dependencies)
- **AI Error**: The AI initially proposed `psycopg2-binary` as the PostgreSQL adapter in `requirements.txt`.
- **How we caught it**: Running `pip install -r requirements.txt` on a Windows machine running Python 3.14 threw a build compilation error. Psycopg2 has no prebuilt wheels for Python 3.14 on Windows and requires Microsoft Visual C++ Build Tools to compile.
- **What we changed**: Modified the adapter to `psycopg[binary]==3.3.4` (Psycopg v3). Psycopg 3 compiles natively and has prebuilt Windows wheels, allowing a successful installation with no C++ build tools required.

### Case 2: DRF Group ViewSet 404 on Joining Groups
- **AI Error**: The AI implemented standard group queryset filtering in `get_queryset` restricting group lookups to users who are already members:
  ```python
  def get_queryset(self):
      return Group.objects.filter(memberships__user=self.request.user)
  ```
- **How we caught it**: When a user tried to join a group via the custom action `/api/groups/{id}/join/`, Django REST Framework returned `404 Not Found` because the user was not yet a member, filtering the group out before the action could be processed.
- **What we changed**: Overrode `get_queryset` to return `Group.objects.all()` specifically for the `join` action:
  ```python
  if self.action == 'join':
      return Group.objects.all()
  ```

### Case 3: Division Remainder Penny Rounding Loss in Splits
- **AI Error**: The AI initially wrote an equal split division without remainder calculations:
  ```python
  share = amount / member_count
  ```
- **How we caught it**: Financial auditing checks failed for division results (e.g. ₹10.00 split among 3 users). Summing `3.33 + 3.33 + 3.33` yields `9.99`, creating a penny imbalance in the ledger.
- **What we changed**: Implemented quantized Decimal division. Calculated the remainder (`10.00 - 9.99 = 0.01`) and redistributed it to the first split participant, ensuring splits sum exactly to the total amount.

### Case 4: Loss of `instance.save()` in View soft-delete Action
- **AI Error**: During a search-and-replace modification of `views.py` to add `CSVImportView`, the replacement content omitted `instance.save()` inside `ExpenseViewSet.destroy()`.
- **How we caught it**: The automated CSV validation test script failed because soft-deleted expenses were still appearing as active, as their `is_deleted` flag was never saved to the database.
- **What we changed**: Restored `instance.save()` immediately inside `views.py` after flagging `instance.is_deleted = True`.

### Case 5: Command Not Found (Exit Status 127) on Render Deployment
- **AI Error**: The AI originally placed `render.yaml` inside `backend/` and did not configure `build.sh` as executable.
- **How we caught it**: Render failed deployments with an exit status `127` because it only scans the root folder for blueprints and lacks execution permission to run `./build.sh`.
- **What we changed**: Moved `render.yaml` to the repository root directory, added `chmod +x build.sh` inside the build commands list, and marked the file executable in Git using `git update-index --chmod=+x backend/build.sh`.
