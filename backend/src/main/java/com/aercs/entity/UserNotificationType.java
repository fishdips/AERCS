package com.aercs.entity;

/** What happened, for a staff member's notifications tab. */
public enum UserNotificationType {
    /** Evidence was added to an activity owned by the recipient's department or office. */
    EVIDENCE_UPLOADED,
    /** A new version of evidence the recipient's unit owns (or references) was saved. */
    EVIDENCE_NEW_VERSION,
    /** Someone tagged evidence for the recipient's department or office in its metadata. */
    EVIDENCE_TAGGED,
    /** Another unit cited the recipient's unit's evidence in one of its activities. */
    EVIDENCE_REFERENCED,
    /** Another unit stopped citing the recipient's unit's evidence. */
    REFERENCE_REMOVED
}
