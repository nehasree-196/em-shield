
import numpy as np

# constants
EPS0 = 8.854187817e-12
MU0 = 4.0 * np.pi * 1e-7
ETA0 = np.sqrt(MU0 / EPS0)


# material database

MATERIALS = {
    "Copper": {
        "sigma": 5.8e7,
        "epsilon_r": 1.0,
        "mu_r": 1.0
    },
    "Aluminum": {
        "sigma": 3.5e7,
        "epsilon_r": 1.0,
        "mu_r": 1.0
    },
    "Steel": {
        "sigma": 6.0e6,
        "epsilon_r": 1.0,
        "mu_r": 100.0
    },
    "Nickel": {
        "sigma": 1.4e7,
        "epsilon_r": 1.0,
        "mu_r": 100.0
    }
}


# calculating complex permittivity

def complex_permittivity(frequency, material):

    if frequency <= 0:
        raise ValueError("Frequency must be positive")

    omega = 2 * np.pi * frequency

    return (
        EPS0 * material["epsilon_r"]
        - 1j * material["sigma"] / omega
    )


# wave properties

def wave_properties(frequency, material,
                    theta_incident, polarization):

    omega = 2 * np.pi * frequency

    eps = complex_permittivity(frequency, material)
    mu = MU0 * material["mu_r"]

    k0 = omega * np.sqrt(MU0 * EPS0)
    kx = k0 * np.sin(theta_incident)

    kz = np.sqrt(omega**2 * mu * eps - kx**2)

    # Passive forward-wave branch for exp(+j omega t)

    if np.imag(kz) > 0:
        kz = -kz

    elif abs(np.imag(kz)) < 1e-12 and np.real(kz) < 0:
        kz = -kz

    if polarization.upper() == "TE":
        impedance = omega * mu / kz

    elif polarization.upper() == "TM":
        impedance = kz / (omega * eps)

    else:
        raise ValueError("Polarization must be TE or TM")

    return kz, impedance


def cascade(A, B):

    denominator = 1.0 - A[1, 1] * B[0, 0]

    if abs(denominator) < 1e-300:
        raise ArithmeticError("Numerical singularity in cascade")

    C = np.zeros((2, 2), dtype=complex)

    C[0, 0] = (
        A[0, 0]
        + A[0, 1] * B[0, 0] * A[1, 0] / denominator
    )

    C[0, 1] = A[0, 1] * B[0, 1] / denominator

    C[1, 0] = B[1, 0] * A[1, 0] / denominator

    C[1, 1] = (
        B[1, 1]
        + B[1, 0] * A[1, 1] * B[0, 1]
        / denominator
    )

    return C


def interface_matrix(eta_a, eta_b):

    denominator = eta_a + eta_b

    if abs(denominator) == 0:
        raise ArithmeticError("Invalid interface impedance")

    r_ab = (eta_b - eta_a) / denominator
    r_ba = -r_ab

    t_ab = 2.0 * eta_b / denominator
    t_ba = 2.0 * eta_a / denominator

    return np.array([
        [r_ab, t_ba],
        [t_ab, r_ba]
    ], dtype=complex)



def propagation_matrix(kz, thickness):

    if thickness < 0:
        raise ValueError("Thickness cannot be negative")

    log_p = -1j * kz * thickness

    with np.errstate(under="ignore"):
        p = np.exp(log_p)

    P = np.array([
        [0.0, p],
        [p, 0.0]
    ], dtype=complex)

    return P, log_p


def calculate_scattering(frequency, layers,
                         theta_incident=0.0,
                         polarization="TE"):

    air = {
        "sigma": 0.0,
        "epsilon_r": 1.0,
        "mu_r": 1.0
    }

    _, eta_air = wave_properties(
        frequency, air, theta_incident, polarization
    )

    if not layers:

        identity = np.array([
            [0.0, 1.0],
            [1.0, 0.0]
        ], dtype=complex)

        return identity, 0.0

    for layer in layers:

        if layer["material"] not in MATERIALS:
            raise ValueError(
                f"Unknown material: {layer['material']}"
            )

        if layer["thickness"] < 0:
            raise ValueError("Thickness cannot be negative")

    # Air to first layer

    first_material = MATERIALS[layers[0]["material"]]

    _, eta_first = wave_properties(
        frequency, first_material,
        theta_incident, polarization
    )

    S = interface_matrix(eta_air, eta_first)

    log_transmission = np.log(abs(S[1, 0]))

    # Process every layer

    for i, layer in enumerate(layers):

        material = MATERIALS[layer["material"]]

        kz, _ = wave_properties(
            frequency, material,
            theta_incident, polarization
        )

        P, log_p = propagation_matrix(
            kz, layer["thickness"]
        )

        # Propagation through current layer

        S = cascade(S, P)

        log_transmission += np.real(log_p)

        # Determine next medium

        if i + 1 < len(layers):

            next_material = MATERIALS[
                layers[i + 1]["material"]
            ]

        else:

            next_material = air

        _, eta_current = wave_properties(
            frequency, material,
            theta_incident, polarization
        )

        _, eta_next = wave_properties(
            frequency, next_material,
            theta_incident, polarization
        )

        I = interface_matrix(eta_current, eta_next)

        denominator = 1.0 - S[1, 1] * I[0, 0]

        if abs(denominator) < 1e-300:
            raise ArithmeticError(
                "Numerical singularity at layer interface"
            )

        # Add interface transmission to logarithmic result

        log_transmission += (
            np.log(abs(I[1, 0]))
            - np.log(abs(denominator))
        )

        S = cascade(S, I)

    return S, log_transmission


# reflection and transmission coefficients

def calculate_rt(frequency, layers,
                 theta_incident=0.0,
                 polarization="TE"):

    S, _ = calculate_scattering(
        frequency, layers,
        theta_incident, polarization
    )

    reflection = S[0, 0]
    transmission = S[1, 0]

    return reflection, transmission


# shielding effectiveness

def calculate_se(frequency, layers,
                 theta_incident=0.0,
                 polarization="TE"):

    _, log_transmission = calculate_scattering(
        frequency, layers,
        theta_incident, polarization
    )

    # Stable calculation:
    # SE = -20 log10(|T|)

    se_db = -20.0 * log_transmission / np.log(10.0)

    return se_db


def calculate_skin_depth(frequency, material):

    omega = 2 * np.pi * frequency
    mu = MU0 * material["mu_r"]
    sigma = material["sigma"]

    if sigma <= 0:
        return np.inf

    return np.sqrt(2.0 / (omega * mu * sigma))


def calculate_omnidirectional_se(
    layers,
    frequencies,
    angles_deg=(0, 25, 50, 75)
):

    detailed_results = {}
    worst_case_se = []

    for frequency in frequencies:

        frequency_results = {}
        values = []

        for angle_deg in angles_deg:

            theta = np.radians(angle_deg)

            for polarization in ("TE", "TM"):

                se = calculate_se(
                    frequency,
                    layers,
                    theta,
                    polarization
                )

                frequency_results[
                    (angle_deg, polarization)
                ] = se

                values.append(se)

        detailed_results[frequency] = frequency_results

        worst_case_se.append(min(values))

    return detailed_results, np.array(worst_case_se)

