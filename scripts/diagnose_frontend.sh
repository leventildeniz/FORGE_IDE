#!/bin/bash

OUTPUT_FILE="frontend_diagnosis.log"

echo "--- Starting Frontend Diagnosis ---" > $OUTPUT_FILE
echo "" >> $OUTPUT_FILE

echo "1. Searching for 'projectRootPath' and 'setProjectRoot' usage in src/ (excluding stores/ide-store.ts):" >> $OUTPUT_FILE
grep -r "projectRootPath" src --include="*.ts" --include="*.tsx" | grep -v "src/stores/ide-store.ts" >> $OUTPUT_FILE
grep -r "setProjectRoot" src --include="*.ts" --include="*.tsx" | grep -v "src/stores/ide-store.ts" >> $OUTPUT_FILE
echo "" >> $OUTPUT_FILE

echo "2. Searching for Zustand 'persist' middleware in src/stores/ide-store.ts:" >> $OUTPUT_FILE
grep -r "persist" src/stores/ide-store.ts >> $OUTPUT_FILE
echo "" >> $OUTPUT_FILE

echo "3. Searching for 'localStorage' usage in src/ (excluding readRecent/writeRecent in index.tsx):" >> $OUTPUT_FILE
grep -r "localStorage" src --include="*.ts" --include="*.tsx" | grep -v "function readRecent" | grep -v "function writeRecent" >> $OUTPUT_FILE
echo "" >> $OUTPUT_FILE

echo "4. Searching for 'useEffect' hooks in src/routes/index.tsx and src/routes/workspace.tsx:" >> $OUTPUT_FILE
grep -r "useEffect" src/routes/index.tsx >> $OUTPUT_FILE
grep -r "useEffect" src/routes/workspace.tsx >> $OUTPUT_FILE
echo "" >> $OUTPUT_FILE

echo "5. Searching for '~/projects' string in frontend (src/) and backend (forge-backend/src/) files:" >> $OUTPUT_FILE
grep -r "~/projects" src/ --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" >> $OUTPUT_FILE
grep -r "~/projects" forge-backend/src/ --include="*.rs" >> $OUTPUT_FILE
echo "" >> $OUTPUT_FILE

echo "--- Frontend Diagnosis Complete ---" >> $OUTPUT_FILE

echo "Diagnosis complete. Output saved to $OUTPUT_FILE"
