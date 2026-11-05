package com.aercs.entity;

public enum Office {
    QUALITY_ASSURANCE_OFFICE,
    RESEARCH_OFFICE,
    HUMAN_RESOURCE_OFFICE,
    FACILITIES_MANAGEMENT_OFFICE,
    COMMUNITY_EXTENSION_SERVICE,
    SAFETY_AND_SECURITY_DEPARTMENT,

    // Service Offices
    STUDENT_SUCCESS_OFFICE,
    REGISTRARS_OFFICE,
    LIBRARY,
    GUIDANCE_CENTER,
    MEDICAL_DENTAL_CLINIC,
    TECHNICAL_SUPPORT_GROUP,
    SAFETY_AND_SECURITY,
    ADMISSIONS_AND_SCHOLARSHIPS,
    NATIONAL_SERVICE_TRAINING_PROGRAM,
    FINANCE_OFFICE,

    // Legacy values
    EXTENSION_OFFICE,
    STUDENT_AFFAIRS_OFFICE;

    public String getDisplayName() {
        return switch (this) {
            case QUALITY_ASSURANCE_OFFICE -> "Quality Assurance Office";
            case RESEARCH_OFFICE -> "Research and Development Coordinating Office";
            case HUMAN_RESOURCE_OFFICE -> "Human Resource Department";
            case FACILITIES_MANAGEMENT_OFFICE -> "Facilities Management Office";
            case SAFETY_AND_SECURITY_DEPARTMENT -> "Safety and Security Department";
            case COMMUNITY_EXTENSION_SERVICE -> "Community Extension Services";
            case FINANCE_OFFICE -> "Finance Office";
            case STUDENT_SUCCESS_OFFICE -> "Student Success Office";
            case REGISTRARS_OFFICE -> "Registrar’s Office";
            case LIBRARY -> "Learning Resource and Activity Center";
            case GUIDANCE_CENTER -> "Guidance Center";
            case MEDICAL_DENTAL_CLINIC -> "Medical-Dental Clinic";
            case TECHNICAL_SUPPORT_GROUP -> "Technical Support Group";
            case SAFETY_AND_SECURITY -> "Safety & Security";
            case ADMISSIONS_AND_SCHOLARSHIPS -> "Admissions & Scholarships";
            case NATIONAL_SERVICE_TRAINING_PROGRAM -> "National Service Training Program";
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
                 ADMISSIONS_AND_SCHOLARSHIPS,
                 NATIONAL_SERVICE_TRAINING_PROGRAM,
                 FINANCE_OFFICE -> true;
            default -> false;
        };
    }
}
