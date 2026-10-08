import { GoogleLogin } from '@react-oauth/google';
import { toast } from 'react-toastify';
import { googleAuth } from '../apis/auth';

function GoogleSignIn({ onSignedIn }) {
  const clientId = process.env.REACT_APP_CLIENT_ID;

  const handleSuccess = async ({ credential }) => {
    if (!credential) {
      toast.error('Google did not return a sign-in credential.');
      return;
    }

    try {
      const { data } = await googleAuth({ tokenId: credential });
      if (!data?.token) {
        toast.error(data?.message || 'Unable to sign in with Google.');
        return;
      }

      localStorage.setItem('userToken', data.token);
      toast.success('Successfully signed in with Google!');
      onSignedIn();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to sign in with Google.');
    }
  };

  if (!clientId) {
    return (
      <button
        type="button"
        disabled
        title="Set REACT_APP_CLIENT_ID to enable Google sign-in"
        className="w-[100%] sm:w-[80%] cursor-not-allowed rounded-lg border border-gray-500 px-4 py-3.5 text-left text-base font-medium text-gray-400"
      >
        Continue with Google (not configured)
      </button>
    );
  }

  return <GoogleLogin onSuccess={handleSuccess} onError={() => toast.error('Google sign-in was cancelled or failed.')} />;
}

export default GoogleSignIn;
