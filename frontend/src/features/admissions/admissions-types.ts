export type AdmissionSection = "personal" | "entry" | "guardians" | "academic" | "medical" | "emergency" | "documents" | "declaration";

export interface PersonalDetails {
  legalFirstName: string; legalLastName: string; preferredName: string; dateOfBirth: string;
  gender: "" | "MALE" | "FEMALE"; nationality: string; countryOfBirth: string;
  religion: string; firstLanguage: string; additionalLanguages: string; applicantEmail: string; applicantPhone: string;
}

export interface EntryDetails {
  academicYear: "2026/2027"; yearGroup: "YEAR_7" | "YEAR_9" | "YEAR_12"; entryTerm: "AUTUMN" | "SPRING" | "SUMMER";
  pupilType: "DAY" | "BOARDING" | "FLEXI_BOARDING"; currentSchoolYear: string; proposedStartDate: string;
}

export const reasonForLeavingOptions = [
  ["ACADEMIC_PROGRESSION", "Academic progression"],
  ["RELOCATION", "Relocation"],
  ["CHANGE_OF_CURRICULUM", "Change of curriculum"],
  ["BOARDING_REQUIREMENT", "Boarding requirement"],
  ["FAMILY_CIRCUMSTANCES", "Family circumstances"],
  ["CURRENT_SCHOOL_CLOSURE", "Current school closure"],
  ["OTHER", "Other"],
] as const;

export type ReasonForLeaving = typeof reasonForLeavingOptions[number][0];

export interface Guardian {
  title: "MR" | "MRS" | "MS" | "DR" | "PROF" | "OTHER"; firstName: string; lastName: string;
  relationship: "MOTHER" | "FATHER" | "STEP_PARENT" | "LEGAL_GUARDIAN" | "OTHER"; parentalResponsibility: boolean;
  email: string; phone: string; alternatePhone: string; occupation: string; livesWithApplicant: boolean;
  preferredContactMethod: "EMAIL" | "SMS" | "PHONE";
  address: { line1: string; line2: string; city: string; countyState: string; postcode: string; country: string };
}

export interface GuardianDetails {
  primaryGuardian: Guardian; addSecondGuardian: boolean; secondGuardian: Guardian;
  custodyOrAccessRestrictions: boolean; restrictionDetails: string;
}

export interface AcademicDetails {
  previousSchoolName: string; previousSchoolAddress: string; previousSchoolCountry: string; attendanceFrom: string;
  attendanceTo: string; curriculum: "NIGERIAN_BRITISH_BLEND";
  currentYearGroup: string; reasonForLeaving: "" | ReasonForLeaving; headteacherName: string; schoolEmail: string; schoolPhone: string;
  englishProficiency: "NATIVE" | "FLUENT" | "INTERMEDIATE" | "BEGINNER"; learningStrengths: string;
  supportHistory: string; permissionToContactSchool: boolean;
}

export interface MedicalDetails {
  doctorName: string; doctorPhone: string; bloodGroup: string; medicalConditions: string; allergies: string;
  regularMedication: string; dietaryRequirements: string; disabilitiesOrSend: boolean; sendDetails: string;
  immunisationsUpToDate: "YES" | "NO" | "UNKNOWN"; mentalHealthOrWelfareNeeds: string; emergencyTreatmentConsent: boolean;
}

export interface EmergencyContact {
  fullName: string; relationship: string; primaryPhone: string; alternatePhone: string; email: string; authorisedToCollect: boolean;
}

export interface EmergencyDetails { contacts: EmergencyContact[]; collectionNotes: string }
export interface DocumentDetails { additionalInformation: string }
export interface DeclarationDetails {
  informationAccurate: boolean; parentalResponsibilityConfirmed: boolean; privacyNoticeAccepted: boolean;
  admissionsTermsAccepted: boolean; marketingConsent: boolean; signatoryName: string; signatoryRelationship: string; signedOn: string;
}

export interface AdmissionFormData {
  personal: PersonalDetails; entry: EntryDetails; guardians: GuardianDetails; academic: AcademicDetails;
  medical: MedicalDetails; emergency: EmergencyDetails; documents: DocumentDetails; declaration: DeclarationDetails;
}

export interface AdmissionDocument {
  id: string; category: string; originalName: string; mimeType: string; sizeBytes: number; uploadedAt: string;
}

export interface AdmissionApplication {
  id: string; applicationNumber: string; status: string; currentStep: number; email: string; firstName: string; lastName: string;
  entryYearGroup?: string; entryAcademicYear: string; formData: Partial<AdmissionFormData>; submittedAt?: string; updatedAt: string;
  documents: AdmissionDocument[];
}

const blankGuardian = (): Guardian => ({
  title: "MR", firstName: "", lastName: "", relationship: "FATHER", parentalResponsibility: true, email: "", phone: "",
  alternatePhone: "", occupation: "", livesWithApplicant: true, preferredContactMethod: "EMAIL",
  address: { line1: "", line2: "", city: "", countyState: "", postcode: "", country: "Nigeria" },
});

export const initialAdmissionData: AdmissionFormData = {
  personal: { legalFirstName: "", legalLastName: "", preferredName: "", dateOfBirth: "", gender: "", nationality: "Nigerian", countryOfBirth: "Nigeria", religion: "", firstLanguage: "English", additionalLanguages: "", applicantEmail: "", applicantPhone: "" },
  entry: { academicYear: "2026/2027", yearGroup: "YEAR_7", entryTerm: "AUTUMN", pupilType: "DAY", currentSchoolYear: "", proposedStartDate: "2026-09-08" },
  guardians: { primaryGuardian: blankGuardian(), addSecondGuardian: false, secondGuardian: { ...blankGuardian(), title: "MRS", relationship: "MOTHER" }, custodyOrAccessRestrictions: false, restrictionDetails: "" },
  academic: { previousSchoolName: "", previousSchoolAddress: "", previousSchoolCountry: "Nigeria", attendanceFrom: "", attendanceTo: "", curriculum: "NIGERIAN_BRITISH_BLEND", currentYearGroup: "", reasonForLeaving: "", headteacherName: "", schoolEmail: "", schoolPhone: "", englishProficiency: "FLUENT", learningStrengths: "", supportHistory: "", permissionToContactSchool: false },
  medical: { doctorName: "", doctorPhone: "", bloodGroup: "", medicalConditions: "", allergies: "", regularMedication: "", dietaryRequirements: "", disabilitiesOrSend: false, sendDetails: "", immunisationsUpToDate: "UNKNOWN", mentalHealthOrWelfareNeeds: "", emergencyTreatmentConsent: false },
  emergency: { contacts: [{ fullName: "", relationship: "", primaryPhone: "", alternatePhone: "", email: "", authorisedToCollect: false }], collectionNotes: "" },
  documents: { additionalInformation: "" },
  declaration: { informationAccurate: false, parentalResponsibilityConfirmed: false, privacyNoticeAccepted: false, admissionsTermsAccepted: false, marketingConsent: false, signatoryName: "", signatoryRelationship: "", signedOn: new Date().toISOString().slice(0, 10) },
};

const reasonCodes = new Set(reasonForLeavingOptions.map(([value]) => value));

export function normalizeAdmissionData(formData: Partial<AdmissionFormData>): AdmissionFormData {
  const suppliedGender = formData.personal?.gender;
  const suppliedReason = formData.academic?.reasonForLeaving;
  return {
    personal: {
      ...initialAdmissionData.personal,
      ...formData.personal,
      gender: suppliedGender === "MALE" || suppliedGender === "FEMALE" ? suppliedGender : "",
    },
    entry: { ...initialAdmissionData.entry, ...formData.entry },
    guardians: { ...initialAdmissionData.guardians, ...formData.guardians },
    academic: {
      ...initialAdmissionData.academic,
      ...formData.academic,
      curriculum: "NIGERIAN_BRITISH_BLEND",
      reasonForLeaving: suppliedReason && reasonCodes.has(suppliedReason as ReasonForLeaving)
        ? suppliedReason as ReasonForLeaving
        : "",
    },
    medical: { ...initialAdmissionData.medical, ...formData.medical },
    emergency: { ...initialAdmissionData.emergency, ...formData.emergency },
    documents: { ...initialAdmissionData.documents, ...formData.documents },
    declaration: { ...initialAdmissionData.declaration, ...formData.declaration },
  };
}
