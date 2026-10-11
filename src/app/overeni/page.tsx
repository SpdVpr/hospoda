import { redirect } from 'next/navigation';

// The dashboard checks the signed-in account and active membership.
export default function VerificationPage() {
    redirect('/dashboard');
}
