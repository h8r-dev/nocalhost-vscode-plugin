import React from "react";

interface Profile {
  name: string;
}

interface AccountProps {
  profile: Profile;
}

const AccountComp: React.FC<AccountProps> = (props) => {
  const { name } = props.profile;
  return (
    <div className="forkmain-account">
      <p style={{ marginBottom: 10 }}>Welcome to ForkMain!</p>
    </div>
  );
};

export default AccountComp;
