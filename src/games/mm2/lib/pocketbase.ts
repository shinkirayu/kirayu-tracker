// MM2's module code imports `pb` from here (same relative path its original
// dashboard used), but there's only one PocketBase client for the whole
// site now — this just re-exports it.
export { pb } from "../../../lib/pocketbase";
