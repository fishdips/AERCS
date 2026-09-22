package com.aercs.entity;

public enum Office {
    QUALITY_ASSURANCE_OFFICE,
    RESEARCH_OFFICE,
    HUMAN_RESOURCE_OFFICE,
    FACILITIES_MANAGEMENT_OFFICE,

    // Service Offices
    STUDENT_SUCCESS_OFFICE,
    REGISTRARS_OFFICE,
    LIBRARY,
    GUIDANCE_CENTER,
    MEDICAL_DENTAL_CLINIC,
    TECHNICAL_SUPPORT_GROUP,
    SAFETY_AND_SECURITY,
    ADMISSIONS_AND_SCHOLARSHIPS,

    // Legacy values
    EXTENSION_OFFICE,
    STUDENT_AFFAIRS_OFFICE;

    public String getDisplayName() {
        return switch (this) {
            case QUALITY_ASSURANCE_OFFICE -> "Quality Assurance Office";
            case RESEARCH_OFFICE -> "Research Office";
            case HUMAN_RESOURCE_OFFICE -> "Human Resource Office";
            case FACILITIES_MANAGEMENT_OFFICE -> "Facilities Management Office";
            case STUDENT_SUCCESS_OFFICE -> "Student Success Office";
            case REGISTRARS_OFFICE -> "Registrar’s Office";
            case LIBRARY -> "Library";
            case GUIDANCE_CENTER -> "Guidance Center";
            case MEDICAL_DENTAL_CLINIC -> "Medical-Dental Clinic";
            case TECHNICAL_SUPPORT_GROUP -> "Technical Support Group";
            case SAFETY_AND_SECURITY -> "Safety & Security";
            case ADMISSIONS_AND_SCHOLARSHIPS -> "Admissions & Scholarships";
            case EXTENSION_OFFICE -> "Extension Office";
            case STUDENT_AFFAIRS_OFFICE -> "Student Affairs Office";
        };
    }

    public boolean isServiceOffice() {
        return switch (this) {
            case STUDENT_SUCCESS_OFFICE,
                 REGISTRARS_OFFICE,
                 LIBRARY,
                 GUIDANCE_CENTER,
                 MEDICAL_DENTAL_CLINIC,
                 TECHNICAL_SUPPORT_GROUP,
                 SAFETY_AND_SECURITY,
                 ADMISSIONS_AND_SCHOLARSHIPS -> true;
            default -> false;
        };
    }
}
