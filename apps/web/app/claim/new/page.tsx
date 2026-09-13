import ClaimIntake from "./ClaimIntake";
import "./claim.css";

export const metadata = {
  title: "Start a claim project — ClaimGrid",
  description: "Create a private, state-aware mineral claim research project."
};

export default function NewClaimPage() {
  return <ClaimIntake />;
}
